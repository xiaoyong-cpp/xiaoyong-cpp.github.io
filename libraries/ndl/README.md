# NDL (Namespace Directory Language)

NDL 是一个轻量级的命名空间数据语言库，用于序列化和反序列化数据到层次化的命名空间结构中。支持基本数据类型（int, float, double, bool, string）的自动序列化，并可以扩展支持自定义类型。

## 主要特性

- **层次化命名空间**：支持多级命名空间结构
- **类型安全**：模板化的序列化和反序列化
- **可扩展性**：支持自定义类型的序列化器和反序列化器
- **注释支持**：支持分号开头的行注释
- **异常处理**：内置异常处理机制

## 快速开始

### 包含头文件

```cpp
#include "ndl.h"
```

### 基本语法

NDL 文件格式示例：

```ndl
$name = ("my_ndl_file") ; ID: name
$modify_date = ("2026.2.7") ; 可以有单独的datetime_serializer/deserialzer
.chunk { ; 声明命名空间chunk
    $line1 = ("line1") ; ID: chunk.line1
    $line2 = ("line2") ; ID: chunk.line2
    $object_with_space = (    a    ) ; 注意：括号内的空格会被保留
}
```

### 解析 NDL

```cpp
#include "ndl.h"

int main() {
    std::string ndl_str = R"(
        $name = ("my_ndl_file")
        .chunk {
            $line1 = ("line1")
            $line2 = ("line2")
            $number = (42)
            $flag = (true)
        }
    )";

    try {
        ndl::NDLDocument doc(ndl_str);
        
        // 获取变量值
        std::string name = doc.get<std::string>("name");
        std::string line1 = doc.get<std::string>("chunk.line1");
        int number = doc.get<int>("chunk.number");
        bool flag = doc.get<bool>("chunk.flag");
        
        // 获取命名空间下的所有变量
        auto all_vars = doc.get_all<std::string>("chunk");
        for (const auto& [key, value] : all_vars) {
            // 处理变量
        }
        
    } catch (const std::exception& e) {
        // 处理异常
    }
    
    return 0;
}
```

### 修改 NDL

```cpp
#include "ndl.h"

int main() {
    ndl::NDLDocument doc;
    
    // 设置变量值
    doc.set<std::string>("name", "my_ndl_file");
    doc.set<std::string>("chunk.line1", "line1");
    doc.set<int>("chunk.number", 42);
    doc.set<bool>("chunk.flag", true);
    
    return 0;
}
```

## API 参考

### ndl::NDLDocument 类

#### 构造函数
- `NDLDocument()` - 默认构造函数
- `NDLDocument(const std::string& str)` - 从字符串构造 NDL 文档

#### 方法
- `template<typename T> T get(std::string _namespace)` - 获取指定命名空间路径下的变量值
- `template<typename T> void set(std::string _namespace, T value)` - 设置指定命名空间路径下的变量值
- `template<typename T> std::map<std::string, T> get_all(std::string _namespace)` - 获取指定命名空间下的所有变量

### 序列化器和反序列化器

NDL 提供了以下类型的序列化器和反序列化器：
- `std::string`
- `int`
- `float`
- `double`
- `bool`

要添加自定义类型的支持，需要特化 `Serializer` 和 `Deserializer` 模板：

```cpp
// 为自定义类型 MyType 添加序列化支持
template<>
class ndl::Serializer<MyType> {
public:
    std::string operator()(const MyType& data) {
        // 实现序列化逻辑
    }
};

// 为自定义类型 MyType 添加反序列化支持
template<>
class ndl::Deserializer<MyType> {
public:
    MyType operator()(const std::string& raw) {
        // 实现反序列化逻辑
    }
};
```

## 依赖

- C++11 或更高版本

## 许可证

MIT 许可证 - 详见 [LICENSE.txt](LICENSE.txt)
