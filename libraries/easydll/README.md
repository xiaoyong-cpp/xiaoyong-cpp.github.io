# EasyDll

EasyDll 是一个轻量级头文件库，用于简化 Windows 平台下动态链接库(DLL)的加载和管理。它提供了类型安全的函数加载、RAII 资源管理以及异常安全保证。

## 主要特性

- **RAII 自动管理**：自动管理 DLL 生命周期，确保资源正确释放
- **类型安全**：模板化的函数指针加载，提供类型安全的调用
- **异常处理**：提供异常和错误处理机制
- **移动语义**：支持 C++11 移动语义
- **线程安全**：单实例级别线程安全

## 快速开始

### 包含头文件

```cpp
#include "easydll.h"
```

### 基本使用

```cpp
#include "easydll.h"

// 定义函数原型
typedef int (*AddFunc)(int, int);

int main() {
    try {
        dll::Library lib("math.dll");
        auto add = lib.GetFunction<AddFunc>("add");
        int result = add(3, 5); // 结果为8
    } catch (const std::exception& e) {
        // 处理异常
    }
    return 0;
}
```

### 高级使用

```cpp
// 延迟加载
dll::Library lib;
if (lib.Load("mylib.dll")) {
    // 加载成功
    auto func = lib.TryLoadFunction<int(int, int)>("add");
    if (func) {
        int result = func(10, 20);
    }
}

// 移动语义
dll::Library lib1("first.dll");
dll::Library lib2 = std::move(lib1); // lib1 现在为空
```

## API 参考

### dll::Library 类

#### 构造函数
- `Library()` - 默认构造函数
- `Library(const char* path)` - 从路径加载 DLL
- `Library(const std::string& path)` - 从路径加载 DLL

#### 方法
- `bool Load(const char* path)` - 加载 DLL 文件
- `bool Load(const std::string& path)` - 加载 DLL 文件
- `bool UnLoad()` - 卸载当前加载的 DLL
- `bool IsLoaded() const` - 检查 DLL 是否已加载
- `template<typename Func> std::function<Func> LoadFunction(const char* name)` - 加载指定名称的函数
- `template<typename T> std::function<T> GetFunction(const char* name)` - 获取指定名称的函数（LoadFunction 的别名）
- `HMODULE GetHandle() const` - 获取底层的 DLL 句柄
- `template<typename Func> std::function<Func> TryLoadFunction(const char* name) noexcept` - 尝试加载函数（不抛出异常）

## 依赖

- C++11 或更高版本
- Windows SDK

## 许可证

MIT 许可证 - 详见 [LICENSE.txt](LICENSE.txt)
