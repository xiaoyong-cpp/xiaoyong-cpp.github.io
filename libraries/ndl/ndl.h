/**
 * @file ndl.h
 * @brief NDL (Namespace Directory Language，命名空间定向标记语言) 库头文件
 * @copyright MIT License
 * 
 * NDL是一个轻量级的命名空间数据语言库，用于序列化和反序列化数据到层次化的命名空间结构中。
 * 支持基本数据类型（int, float, double, bool, string）的自动序列化，并可以扩展支持自定义类型。
 * 
 * @author xiaoyong-cpp
 * @date 2026-02-09
 * @version Debug-1.2
 */

#ifndef NDL_H
#define NDL_H

#include <string>
#include <vector>
#include <fstream>
#include <variant>
#include <map>
#include <cstdio>
#include <typeinfo>
#include <sstream>

#ifdef __ndl_debug__
template<typename... Args>
void debug(std::string str, Args... args) {
    fprintf(stderr, ("[Debug]: " + str).c_str(), args...);
}
#else
template<typename... Args>
void debug(std::string str, Args... args) {}
#endif

namespace ndl {
    
    /**
     * @brief 将字符串按点号分割成多个部分
     * 
     * 用于解析命名空间路径，例如 `"Abc.MyNamespace.PI"` 会被分割为 `["Abc", "MyNamespace", "PI"]`
     * 
     * @param str 要分割的字符串
     * @return std::vector<std::string> 分割后的字符串数组
     */
    std::vector<std::string> split(const std::string& str) {
        std::string cur = "";
        std::vector<std::string> res;
        for(int i = 0; i < str.size(); i++) {
            if(str[i] == '.') {
                res.push_back(cur);
                cur = "";
            } else {
                cur.push_back(str[i]);
            }
        }
        if (!cur.empty()) {
            res.push_back(cur);
        }
        return res;
    }
    
    /**
     * @brief 反序列化器模板基类
     * 
     * 用于将字符串数据反序列化为指定类型T的对象。
     * 需要为每种类型提供特化实现。
     * 
     * @tparam T 要反序列化的目标类型
     */
    /**
     * @brief 反序列化器模板基类
     * 
     * 用于将字符串数据反序列化为指定类型T的对象。
     * 需要为每种类型提供特化实现。
     * 
     * @tparam T 要反序列化的目标类型
     */
    template <typename T>
    class Deserializer {
    public:
        /**
         * @brief 反序列化操作符
         * 
         * 将原始字符串数据转换为类型T的对象。
         * 
         * @param raw 原始字符串数据
         * @return T 反序列化后的对象
         * @throw std::string 如果类型T的反序列化器未声明
         */
        virtual T operator()(const std::string& raw) {
            std::ostringstream oss;
            oss << "Deserializer of type\'" << typeid(T).name() << "\' is not declared";
            throw oss.str();
        }
        virtual ~Deserializer() = default;
    };

    /**
     * @brief 序列化器模板基类
     * 
     * 用于将类型T的对象序列化为字符串数据。
     * 需要为每种类型提供特化实现。
     * 
     * @tparam T 要序列化的源类型
     */
    /**
     * @brief 序列化器模板基类
     * 
     * 用于将类型T的对象序列化为字符串数据。
     * 需要为每种类型提供特化实现。
     * 
     * @tparam T 要序列化的源类型
     */
    template<typename T>
    class Serializer {
    public:
        /**
         * @brief 序列化操作符
         * 
         * 将类型T的对象转换为字符串表示。
         * 
         * @param data 要序列化的对象
         * @return std::string 序列化后的字符串
         * @throw std::string 如果类型T的序列化器未声明
         */
        virtual std::string operator()(const T& data) {
            std::ostringstream oss;
            oss << "Serializer of type\'" << typeid(T).name() << "\' is not declared";
            throw oss.str();
        }
        virtual ~Serializer() = default;
    };

    /**
     * @brief NDL命名空间结构
     * 
     * 表示NDL文档中的一个命名空间节点，可以包含子命名空间和变量。
     */
    /**
     * @brief NDL命名空间结构
     * 
     * 表示NDL文档中的一个命名空间节点，可以包含子命名空间和变量。
     */
    struct NDLNamespace {
        std::map<std::string, NDLNamespace*> childNamespaces; ///< 子命名空间映射
        std::map<std::string, std::string> childVariables;     ///< 变量映射
        
        /**
         * @brief 默认构造函数
         */
        NDLNamespace() {}
        
        /**
         * @brief 析构函数
         * 
         * 自动清理所有子命名空间的内存。
         */
        ~NDLNamespace() {
            for (auto& [name, ptr] : childNamespaces) {
                delete ptr;
            }
        }
        
        /**
         * @brief 从输入流构造命名空间
         * 
         * 解析输入流中的NDL语法，构建命名空间层次结构。
         * 
         * @param iss 输入字符串流，包含NDL格式的数据
         * @throw const char* 如果语法错误
         */
        /**
         * @brief 从输入流构造命名空间
         * 
         * 解析输入流中的NDL语法，构建命名空间层次结构。
         * 
         * @param iss 输入字符串流，包含NDL格式的数据
         * @throw const char* 如果语法错误
         */
        NDLNamespace(std::istringstream& iss, int layer = 0) {
            
            std::string tok;
            while(iss >> tok) {
                if (tok.empty()) continue;
                
                std::string name = tok.substr(1);
                for(int i = 0; i < layer; i++) debug(" ");
                debug("Visiting \"%s\"\n", name.c_str());
                if(tok[0] == '.') {
                    while(iss.peek() == ' ') iss.get(); // 跳过空格
                    if (iss.peek() != '{') {
                        throw "Expected '{' after namespace declaration";
                    }
                    iss.get(); // 跳过'{'
                    
                    NDLNamespace* newspace = new NDLNamespace(iss, layer + 1);
                    childNamespaces[name] = newspace;
                } else if(tok[0] == '$') {
                    std::string remain; 
                    std::getline(iss, remain);
                    size_t eq_pos = remain.find('=');
                    if(eq_pos == std::string::npos) { 
                        throw "Cannot find an '=' in this line.";
                    }
                    std::string raw_value = remain.substr(eq_pos + 1);
                    size_t first = raw_value.find_first_of("(");
                    size_t last = raw_value.find_last_of(")");
                    if (first == std::string::npos || last == std::string::npos) {
                        throw "Invalid value in this line.";
                    }
                    raw_value = raw_value.substr(first + 1, last - first - 1); // `  ("Hello")   ` -> `"Hello"`
                    childVariables[name] = raw_value;
                } else if (tok == "}") {
                    break;
                }
            }
        }
    };
    
    /**
     * @brief NDL文档类
     * 
     * 表示整个NDL文档，提供数据访问和修改接口。
     */
    /**
     * @brief NDL文档类
     * 
     * 表示整个NDL文档，提供数据访问和修改接口。
     */
    class NDLDocument {
    private:
        NDLNamespace root; ///< 文档根命名空间
        
        /**
         * @brief 移除字符串中的注释
         * 
         * 过滤掉以分号开头的行注释，支持转义分号。
         * 
         * @param str 原始字符串
         * @param result 过滤后的结果字符串
         */
        void removeComments(const std::string& str, std::string& result) {
            for(int i = 0; i < str.size(); i++) {
                if(str[i] == ';' && (i == 0 || str[i - 1] != '\\')) {
                    // 跳过注释直到行尾
                    while(i < str.size() && str[i] != '\n') i++;
                    if (i < str.size()) result.push_back(str[i]); // 保留换行符
                } else {
                    result.push_back(str[i]);
                }
            }
        }
        
    public:
        /**
         * @brief 默认构造函数
         */
        NDLDocument() {}
        /**
         * @brief 从字符串构造NDL文档
         * 
         * 解析NDL格式的字符串，构建文档结构。
         * 
         * @param str NDL格式的字符串
         */
        NDLDocument(const std::string& str) {
            std::string str_without_comment;
            removeComments(str, str_without_comment);
            std::istringstream iss(str_without_comment);
            root = NDLNamespace(iss);
        } 

        /**
         * @brief 获取指定命名空间路径下的变量值
         * 
         * 例如：`get<int>("Abc.MyNamespace.PI")` 返回命名空间`Abc.MyNamespace`中的`PI`变量值
         * 
         * @tparam T 变量值的类型
         * @param _namespace 命名空间路径，使用点号分隔
         * @return T 变量的值
         * @throw std::runtime_error 如果命名空间或变量不存在
         */
        template<typename T>
        T get(std::string _namespace) {
            std::vector<std::string> layer = split(_namespace); // {"Abc", "MyNamespace", "PI"}  // 修复：添加std::
            NDLNamespace* current = &root; // root
            std::string final_name = layer.back(); 
            layer.pop_back(); // {"Abc", "MyNamespace"} => "PI"
            for(std::string& str : layer) {
                if (current->childNamespaces.count(str) == 0) {  // 修复：添加安全检查
                    throw std::runtime_error("Namespace not found: " + str);
                }
                current = current->childNamespaces[str];
            }
            if (current->childVariables.count(final_name) == 0) {  // 修复：添加变量存在检查
                throw std::runtime_error("Variable not found: " + final_name);
            }
            return Deserializer<T>()(current->childVariables[final_name]); // PI
        }

        /**
         * @brief 设置指定命名空间路径下的变量值
         * 
         * 例如：`set<int>("Abc.MyNamespace.age", 15)` 设置命名空间`Abc.MyNamespace`中的`age`变量值
         * 
         * @tparam T 变量值的类型
         * @param _namespace 命名空间路径，使用点号分隔
         * @param value 要设置的值
         * @throw std::runtime_error 如果命名空间不存在
         */
        template<typename T>
        void set(std::string _namespace, T value) {
            std::vector<std::string> layer = split(_namespace); // {"Abc", "MyNamespace", "age"}  // 修复：添加std::
            NDLNamespace* current = &root; // root
            std::string final_name = layer.back(); 
            layer.pop_back(); // {"Abc", "MyNamespace"} => "age"
            for(std::string& str : layer) { // root -> Abc -> MyNamespace
                if(current->childNamespaces.count(str) == 0) {
                    std::ostringstream oss;
                    oss << "Namespace \'" << str << "\' is not found";
                    throw std::runtime_error(oss.str());
                }
                current = current->childNamespaces[str];
            }
            current->childVariables[final_name] = Serializer<T>()(value); // age = 15  // 修复：使用正确的变量名
        }

        /**
         * @brief 获取指定命名空间下的所有变量
         * 
         * 返回一个映射表，包含命名空间中所有变量的名称和值。
         * 
         * @tparam T 变量值的类型
         * @param _namespace 命名空间路径
         * @return std::map<std::string, T> 变量名到值的映射
         * @throw std::runtime_error 如果命名空间不存在或反序列化失败
         */
        template<typename T>
        std::map<std::string, T> get_all(std::string _namespace) {
            Deserializer<T> des;
            NDLNamespace* current = &root;  // 修复：获取地址
            std::vector<std::string> layer = split(_namespace);  // 修复：添加std::
            for(std::string& str : layer) {
                if(current->childNamespaces.count(str) == 0) {
                    std::ostringstream oss;
                    oss << "Namespace \'" << str << "\' is not found";
                    throw std::runtime_error(oss.str());
                }
                current = current->childNamespaces[str];
            }
            std::map<std::string, T> res;
            for(auto& [key, value] : current->childVariables) {
                try {
                    res[key] = des(value);
                } catch (const std::exception& e) {
                    throw std::runtime_error("Failed to deserialize variable '" + key + "': " + e.what());
                }
            }
            return res;
        }
    };

    /*
        $name = ("my_ndl_file") ; ID: name
        $modify_date = (2026.2.7) ; 可以有单独的datetime_serializer/deserialzer
        .chunk { ; 声明命名空间chunk
            $line1 = ("line1") ; ID: chunk.line1
            $line2 = ("line2") ; ID: chunk.line2
            $object_with_space = (    a    ) ; 注意：这回调用Deserializer<T>()("    a    ")而非Deserializer<T>()("a")。让用户处理括号内的空格逻辑。
        }
    */

    // ========== 反序列化器特化实现 ==========
    
    /**
     * @brief 字符串类型的反序列化器特化
     */
    template<>
    class Deserializer<std::string> {
    public:
        /**
         * @brief 反序列化字符串
         * 
         * 支持转义字符：\\n, \\t, \\\\, \\', \\", \\;, \\(, \\)
         * 
         * @param raw 原始字符串数据（应包含双引号）
         * @return std::string 反序列化后的字符串
         * @throw const char* 如果字符串格式不正确
         */
        std::string operator()(const std::string& raw) {
            if(raw.empty() || raw[0] != '\"' || raw.back() != '\"') throw "Incomplete string on '\"'";
            std::string res = "";
            for(int i = 1; i < raw.size() - 1; i++) {
                if(raw[i] == '\\') {
                    if(i + 1 == raw.size() - 1) throw "Incomplete escape on '\\'";
                    i++; 
                    if(raw[i] == 'n') res += '\n';          // '\n'
                    else if(raw[i] == '\\') res += '\\';    // '\\'
                    else if(raw[i] == 't') res += '\t';     // '\t'
                    else if(raw[i] == '\'') res += '\'';    // '\''
                    else if(raw[i] == '\"') res += '\"';    // '\"'
                    else if(raw[i] == ';') res += ';';      // '\;'
                    else if(raw[i] == '(') res += '(';       // '\('
                    else if(raw[i] == ')') res += ')';       // '\)'
                    else {
                        std::ostringstream exception;
                        exception << "Unknown escape on\'\\" << raw[i] << "\'";
                        throw exception.str();
                    }
                } else  {
                    res.push_back(raw[i]);
                }
            }
            return res;
        }
    };
    
    /**
     * @brief 整数类型的反序列化器特化
     */
    /**
     * @brief 整数类型的反序列化器特化
     */
    template<>
    class Deserializer<int> {
    public:
        /**
         * @brief 反序列化整数
         * 
         * @param raw 包含整数的字符串
         * @return int 解析后的整数值
         * @throw std::invalid_argument 如果字符串不是有效的整数
         */
        int operator()(const std::string& raw) {
            return std::stoi(raw);
        }
    };

    /**
     * @brief 单精度浮点数类型的反序列化器特化
     */
    /**
     * @brief 单精度浮点数类型的反序列化器特化
     */
    template<>
    class Deserializer<float> {
    public:
        /**
         * @brief 反序列化单精度浮点数
         * 
         * @param raw 包含浮点数的字符串
         * @return float 解析后的浮点数值
         * @throw std::invalid_argument 如果字符串不是有效的浮点数
         */
        float operator()(const std::string& raw) {
            return std::stof(raw);
        }
    };

    /**
     * @brief 双精度浮点数类型的反序列化器特化
     */
    /**
     * @brief 双精度浮点数类型的反序列化器特化
     */
    template<>
    class Deserializer<double> {
    public:
        /**
         * @brief 反序列化双精度浮点数
         * 
         * @param raw 包含浮点数的字符串
         * @return double 解析后的浮点数值
         * @throw std::invalid_argument 如果字符串不是有效的浮点数
         */
        double operator()(const std::string& raw) {
            return std::stod(raw);
        }
    };

    /**
     * @brief 布尔类型的反序列化器特化
     */
    /**
     * @brief 布尔类型的反序列化器特化
     */
    template<>
    class Deserializer<bool> {
    public:
        /**
         * @brief 反序列化布尔值
         * 
         * 只接受 "true" 和 "false" 字符串
         * 
         * @param raw 包含布尔值的字符串
         * @return bool 解析后的布尔值
         * @throw std::string 如果字符串不是 "true" 或 "false"
         */
        bool operator()(const std::string& raw) {
            if(raw != "true" && raw != "false") {
                std::ostringstream exception;
                exception << "Unknown bool value on \'" << raw << "\'";
                throw exception.str();
            }
            return raw == "true";
        }
    };

    // ========== 序列化器特化实现 ==========
    
    /**
     * @brief 字符串类型的序列化器特化
     */
    template<>
    class Serializer<std::string> {
    public:
        /**
         * @brief 序列化字符串
         * 
         * 将字符串用双引号包围，并转义特殊字符
         * 
         * @param data 要序列化的字符串
         * @return std::string 序列化后的字符串（包含双引号）
         */
        std::string operator()(const std::string& data) {
            std::string res = "\"";
            for(char c : data) {
                if(c == '\\') res += '\\';
                else if(c == '\n') res += 'n';
                else if(c == '\t') res += 't';
                else if(c == '\'') res += '\'';
                else if(c == '\"') res += '\"';
                else if(c == ';') res += ';';
                else if(c == '(') res += '(';
                else if(c == ')') res += ')';
                else res += c;
            }
            res += "\"";
            return res;
        }
    };

    /**
     * @brief 整数类型的序列化器特化
     */
    /**
     * @brief 整数类型的序列化器特化
     */
    template<>
    class Serializer<int> {
    public:
        /**
         * @brief 序列化整数
         * 
         * @param data 要序列化的整数
         * @return std::string 整数的字符串表示
         */
        std::string operator()(const int& data) {
            return std::to_string(data);
        }
    };

    /**
     * @brief 单精度浮点数类型的序列化器特化
     */
    /**
     * @brief 单精度浮点数类型的序列化器特化
     */
    template<>
    class Serializer<float> {
    public:
        /**
         * @brief 序列化单精度浮点数
         * 
         * @param data 要序列化的浮点数
         * @return std::string 浮点数的字符串表示
         */
        std::string operator()(const float& data) {
            return std::to_string(data);
        }
    };

    /**
     * @brief 双精度浮点数类型的序列化器特化
     */
    /**
     * @brief 双精度浮点数类型的序列化器特化
     */
    template<>
    class Serializer<double> {
    public:
        /**
         * @brief 序列化双精度浮点数
         * 
         * @param data 要序列化的浮点数
         * @return std::string 浮点数的字符串表示
         */
        std::string operator()(const double& data) {
            return std::to_string(data);
        }
    };
        
    /**
     * @brief 布尔类型的序列化器特化
     */
    /**
     * @brief 布尔类型的序列化器特化
     */
    template<>
    class Serializer<bool> {
    public:
        /**
         * @brief 序列化布尔值
         * 
         * @param data 要序列化的布尔值
         * @return std::string "true" 或 "false"
         */
        std::string operator()(const bool& data) {
            return data ? "true" : "false";
        }
    };
}

#endif