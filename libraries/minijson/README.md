# MiniJSON

MiniJSON 是一个轻量级的 C++ JSON 解析和序列化库，支持所有标准 JSON 类型：null、boolean、number、string、array 和 object。

## 主要特性

- **轻量级**：仅一个头文件，无需外部依赖
- **完整支持**：支持所有标准 JSON 类型
- **易用性**：提供简单直观的 API
- **异常处理**：内置异常处理机制
- **跨平台**：纯 C++ 实现，可在任何支持 C++11 的平台上使用

## 快速开始

### 包含头文件

```cpp
#include "minijson.hpp"
```

### 解析 JSON

```cpp
#include "minijson.hpp"

int main() {
    std::string json_str = R"({
        "name": "John",
        "age": 30,
        "isStudent": false,
        "courses": ["Math", "English", "Computer Science"],
        "address": {
            "city": "New York",
            "zipCode": 10001
        }
    })";

    try {
        minijson::JsonValue root = minijson::JsonParser::parse(json_str);
        
        // 访问对象属性
        std::string name = root["name"].asString();
        int age = root["age"].asInt();
        bool isStudent = root["isStudent"].asBool();
        
        // 访问数组元素
        std::string course = root["courses"][0].asString();
        
        // 访问嵌套对象
        std::string city = root["address"]["city"].asString();
        
    } catch (const std::exception& e) {
        // 处理解析错误
    }
    
    return 0;
}
```

### 构建和序列化 JSON

```cpp
#include "minijson.hpp"

int main() {
    // 创建 JSON 对象
    minijson::JsonValue obj;
    
    // 添加属性
    obj["name"] = "John";
    obj["age"] = 30;
    obj["isStudent"] = false;
    
    // 创建数组
    minijson::JsonValue courses;
    courses.push_back("Math");
    courses.push_back("English");
    courses.push_back("Computer Science");
    obj["courses"] = courses;
    
    // 创建嵌套对象
    minijson::JsonValue address;
    address["city"] = "New York";
    address["zipCode"] = 10001;
    obj["address"] = address;
    
    // 序列化为字符串
    std::string json_str = minijson::JsonSerializer::serialize(obj);
    std::cout << json_str << std::endl;
    
    return 0;
}
```

## API 参考

### minijson::JsonValue 类

#### 构造函数
- `JsonValue()` - 创建 null 值
- `JsonValue(bool value)` - 创建布尔值
- `JsonValue(double value)` - 创建数字值
- `JsonValue(int value)` - 创建数字值
- `JsonValue(const std::string& value)` - 创建字符串值
- `JsonValue(const char* value)` - 创建字符串值

#### 方法
- `Type getType() const` - 获取值的类型
- `bool isNull() const` - 检查是否为 null
- `bool isBool() const` - 检查是否为布尔值
- `bool isNumber() const` - 检查是否为数字
- `bool isString() const` - 检查是否为字符串
- `bool isArray() const` - 检查是否为数组
- `bool isObject() const` - 检查是否为对象
- `bool asBool() const` - 转换为布尔值
- `double asNumber() const` - 转换为数字
- `int asInt() const` - 转换为整数
- `const std::string& asString() const` - 转换为字符串
- `const std::vector<JsonValue>& asArray() const` - 转换为数组
- `const std::map<std::string, JsonValue>& asObject() const` - 转换为对象
- `JsonValue& operator[](size_t index)` - 访问数组元素
- `JsonValue& operator[](const std::string& key)` - 访问对象属性
- `void push_back(const JsonValue& value)` - 向数组添加元素
- `size_t size() const` - 获取数组或对象的大小

### minijson::JsonParser 类

#### 静态方法
- `static JsonValue parse(const std::string& json)` - 解析 JSON 字符串

### minijson::JsonSerializer 类

#### 静态方法
- `static std::string serialize(const JsonValue& value)` - 序列化 JSON 值为字符串

## 依赖

- C++11 或更高版本

## 许可证

MIT 许可证 - 详见 [LICENSE.txt](LICENSE.txt)
