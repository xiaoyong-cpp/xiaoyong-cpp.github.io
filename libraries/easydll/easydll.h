/**
 * @file    easydll.h
 * @brief   简化C++动态链接库(DLL)加载的封装类
 * @author  ckj20111020
 * @date    2026.01.02
 * @version 1.0.0
 * 
 * @details EasyDll是一个轻量级头文件库，用于简化Windows平台下动态链接库(DLL)的加载和管理。
 *          它提供了类型安全的函数加载、RAII资源管理以及异常安全保证。
 * 
 * @copyright MIT License
 * 
 * @section features 主要特性
 * - RAII自动管理DLL生命周期
 * - 类型安全的函数指针加载
 * - 支持异常和错误处理
 * - 移动语义支持
 * - 线程安全（单实例级别）
 * 
 * @section usage 使用示例
 * @code{.cpp}
 * #include "easydll.h"
 * 
 * // 定义函数原型
 * typedef int (*AddFunc)(int, int);
 * 
 * int main() {
 *     try {
 *         dll::Library lib("math.dll");
 *         auto add = lib.GetFunction<AddFunc>("add");
 *         int result = add(3, 5); // 结果为8
 *     } catch (const std::exception& e) {
 *         // 处理异常
 *     }
 *     return 0;
 * }
 * @endcode
 */

#ifndef EASYDLL_H
#define EASYDLL_H

#include <windows.h>
#include <functional>
#include <string>
#include <stdexcept>

namespace dll {
    
    /**
     * @class Library
     * @brief DLL加载和管理类
     * 
     * 提供动态链接库的加载、卸载、函数获取等功能。
     * 使用RAII模式确保资源正确释放，支持移动语义但不支持拷贝。
     */
    class Library {
    public:
        /**
         * @brief 默认构造函数
         * @post IsLoaded() 返回 false
         */
        Library() : hDll(nullptr) {}
        
        /**
         * @brief 从路径加载DLL
         * @param path DLL文件路径（C风格字符串）
         * @throw std::runtime_error 如果加载失败
         */
        explicit Library(const char* path) {
            Load(path);
        }
        
        /**
         * @brief 从路径加载DLL
         * @param path DLL文件路径（std::string）
         * @throw std::runtime_error 如果加载失败
         */
        explicit Library(const std::string& path) {
            Load(path);
        }
        
        /** @brief 禁止拷贝构造函数 */
        Library(const Library&) = delete;
        
        /** @brief 禁止拷贝赋值运算符 */
        Library& operator=(const Library&) = delete;
        
        /**
         * @brief 移动构造函数
         * @param other 源对象（移动后变为空状态）
         */
        Library(Library&& other) noexcept : hDll(other.hDll) {
            other.hDll = nullptr;
        }
        
        /**
         * @brief 移动赋值运算符
         * @param other 源对象（移动后变为空状态）
         * @return Library& 当前对象引用
         */
        Library& operator=(Library&& other) noexcept {
            if (this != &other) {
                UnLoad();
                hDll = other.hDll;
                other.hDll = nullptr;
            }
            return *this;
        }
        
        /**
         * @brief 析构函数
         * @note 自动卸载已加载的DLL
         */
        ~Library() {
            UnLoad();
        }
        
        /**
         * @brief 加载DLL文件
         * @param path DLL文件路径（C风格字符串）
         * @return bool 加载是否成功
         * @note 如果已有加载的DLL，会先卸载
         * 
         * @code{.cpp}
         * dll::Library lib;
         * if (lib.Load("mylib.dll")) {
         *     // 加载成功
         * }
         * @endcode
         */
        bool Load(const char* path) {
            UnLoad();
            hDll = LoadLibraryA(path);
            return IsLoaded();
        }
        
        /**
         * @brief 加载DLL文件
         * @param path DLL文件路径（std::string）
         * @return bool 加载是否成功
         */
        bool Load(const std::string& path) {
            return Load(path.c_str());
        }
        
        /**
         * @brief 卸载当前加载的DLL
         * @return bool 是否成功卸载（如果未加载返回false）
         */
        bool UnLoad() {
            if (hDll) {
                FreeLibrary(hDll);
                hDll = nullptr;
                return true;
            }
            return false;
        }
        
        /**
         * @brief 检查DLL是否已加载
         * @return bool 如果DLL已加载返回true，否则false
         */
        bool IsLoaded() const {
            return hDll != nullptr;
        }
        
        /**
         * @brief 加载指定名称的函数
         * @tparam Func 函数指针类型（例如：int(*)(int, int)）
         * @param name 函数名称
         * @return std::function<Func> 封装好的函数对象
         * @throw std::runtime_error 如果DLL未加载或函数不存在
         * 
         * @code{.cpp}
         * auto func = lib.LoadFunction<int(int, int)>("add");
         * int result = func(2, 3); // 调用函数
         * @endcode
         */
        template<typename Func>
        std::function<Func> LoadFunction(const char* name) {
            if (!hDll) {
                throw std::runtime_error("DLL not loaded");
            }
            
            FARPROC address = GetProcAddress(hDll, name);
            if (!address) {
                throw std::runtime_error(std::string("Function not found: ") + name);
            }
            
            return reinterpret_cast<Func*>(address);
        }
        
        /**
         * @brief 获取指定名称的函数（LoadFunction的别名）
         * @tparam T 函数指针类型
         * @param name 函数名称
         * @return std::function<T> 封装好的函数对象
         */
        template<typename T>
        std::function<T> GetFunction(const char* name) {
            return LoadFunction<T>(name);
        }
        
        /**
         * @brief 获取底层的DLL句柄
         * @return HMODULE Windows DLL句柄
         * @warning 返回的句柄由Library对象管理，不要手动释放
         */
        HMODULE GetHandle() const {
            return hDll;
        }
        
        /**
         * @brief 尝试加载函数（不抛出异常）
         * @tparam Func 函数指针类型
         * @param name 函数名称
         * @return std::function<Func> 成功返回函数对象，失败返回空函数
         * @note 此方法在失败时返回空函数而不是抛出异常
         * 
         * @code{.cpp}
         * auto func = lib.TryLoadFunction<int(int)>("optional_func");
         * if (func) {
         *     func(42); // 函数存在，安全调用
         * }
         * @endcode
         */
        template<typename Func>
        std::function<Func> TryLoadFunction(const char* name) noexcept {
            if (!hDll) {
                return nullptr;
            }
            
            FARPROC address = GetProcAddress(hDll, name);
            if (!address) {
                return nullptr;
            }
            
            return reinterpret_cast<Func*>(address);
        }
        
    private:
        HMODULE hDll = nullptr; ///< Windows DLL句柄
    };

} // namespace dll

#endif // EASYDLL_H