/*!
 * \file minijson.hpp
 * \brief 轻量级 JSON 解析和序列化库
 * 
 * 这个库提供了一种简单高效的方式来在 C++ 中解析和序列化 JSON 数据。
 * 它支持所有标准 JSON 类型：null、boolean、number、string、array 和 object。
 */

#ifndef MINIJSON_HPP
#define MINIJSON_HPP

#include <iostream>
#include <string>
#include <vector>
#include <map>
#include <stdexcept>
#include <sstream>
#include <cctype>

/*!
 * \namespace minijson
 * \brief minijson 命名空间包含所有用于 JSON 解析和序列化的类和函数
 */
namespace minijson {

class JsonValue {
public:
    enum Type {
        NULL_TYPE,
        BOOL_TYPE,
        NUMBER_TYPE,
        STRING_TYPE,
        ARRAY_TYPE,
        OBJECT_TYPE
    };

    JsonValue() : type(NULL_TYPE) {}
    JsonValue(bool value) : type(BOOL_TYPE), bool_value(value) {}
    JsonValue(double value) : type(NUMBER_TYPE), number_value(value) {}
    JsonValue(int value) : type(NUMBER_TYPE), number_value(static_cast<double>(value)) {}
    JsonValue(const std::string& value) : type(STRING_TYPE), string_value(value) {}
    JsonValue(const char* value) : type(STRING_TYPE), string_value(value) {}
    JsonValue(const JsonValue& other) : type(other.type) {
        switch (type) {
            case BOOL_TYPE: bool_value = other.bool_value; break;
            case NUMBER_TYPE: number_value = other.number_value; break;
            case STRING_TYPE: string_value = other.string_value; break;
            case ARRAY_TYPE: array_value = other.array_value; break;
            case OBJECT_TYPE: object_value = other.object_value; break;
            default: break;
        }
    }

    Type getType() const { return type; }

    bool isNull() const { return type == NULL_TYPE; }
    bool isBool() const { return type == BOOL_TYPE; }
    bool isNumber() const { return type == NUMBER_TYPE; }
    bool isString() const { return type == STRING_TYPE; }
    bool isArray() const { return type == ARRAY_TYPE; }
    bool isObject() const { return type == OBJECT_TYPE; }

    bool asBool() const {
        if (!isBool()) throw std::runtime_error("Not a boolean");
        return bool_value;
    }

    double asNumber() const {
        if (!isNumber()) throw std::runtime_error("Not a number");
        return number_value;
    }

    int asInt() const {
        return static_cast<int>(asNumber());
    }

    const std::string& asString() const {
        if (!isString()) throw std::runtime_error("Not a string");
        return string_value;
    }

    const std::vector<JsonValue>& asArray() const {
        if (!isArray()) throw std::runtime_error("Not an array");
        return array_value;
    }

    const std::map<std::string, JsonValue>& asObject() const {
        if (!isObject()) throw std::runtime_error("Not an object");
        return object_value;
    }

    JsonValue& operator[](size_t index) {
        if (!isArray()) throw std::runtime_error("Not an array");
        if (index >= array_value.size()) throw std::out_of_range("Array index out of range");
        return array_value[index];
    }

    const JsonValue& operator[](size_t index) const {
        if (!isArray()) throw std::runtime_error("Not an array");
        if (index >= array_value.size()) throw std::out_of_range("Array index out of range");
        return array_value[index];
    }

    JsonValue& operator[](int index) {
        return operator[](static_cast<size_t>(index));
    }

    const JsonValue& operator[](int index) const {
        return operator[](static_cast<size_t>(index));
    }

    JsonValue& operator[](const std::string& key) {
        if (!isObject()) {
            if (isNull()) {
                type = OBJECT_TYPE;
            } else {
                throw std::runtime_error("Not an object");
            }
        }
        return object_value[key];
    }

    const JsonValue& operator[](const std::string& key) const {
        if (!isObject()) throw std::runtime_error("Not an object");
        auto it = object_value.find(key);
        if (it == object_value.end()) throw std::out_of_range("Key not found");
        return it->second;
    }

    JsonValue& operator[](const char* key) {
        return operator[](std::string(key));
    }

    const JsonValue& operator[](const char* key) const {
        return operator[](std::string(key));
    }

    void push_back(const JsonValue& value) {
        if (!isArray()) {
            if (isNull()) {
                type = ARRAY_TYPE;
            } else {
                throw std::runtime_error("Not an array");
            }
        }
        array_value.push_back(value);
    }

    size_t size() const {
        if (isArray()) return array_value.size();
        if (isObject()) return object_value.size();
        throw std::runtime_error("Size not applicable");
    }

private:
    Type type;
    union {
        bool bool_value;
        double number_value;
    };
    std::string string_value;
    std::vector<JsonValue> array_value;
    std::map<std::string, JsonValue> object_value;

    friend class JsonParser;
};

class JsonParser {
public:
    static JsonValue parse(const std::string& json) {
        size_t pos = 0;
        return parseValue(json, pos);
    }

private:
    static void skipWhitespace(const std::string& json, size_t& pos) {
        while (pos < json.size() && std::isspace(json[pos])) {
            pos++;
        }
    }

    static JsonValue parseValue(const std::string& json, size_t& pos) {
        skipWhitespace(json, pos);
        if (pos >= json.size()) throw std::runtime_error("Unexpected end of input");

        char c = json[pos];
        if (c == '{') {
            return parseObject(json, pos);
        } else if (c == '[') {
            return parseArray(json, pos);
        } else if (c == '"') {
            return parseString(json, pos);
        } else if (c == 't' || c == 'f') {
            return parseBoolean(json, pos);
        } else if (c == 'n') {
            return parseNull(json, pos);
        } else if (std::isdigit(c) || c == '-') {
            return parseNumber(json, pos);
        } else {
            throw std::runtime_error("Unexpected character: " + std::string(1, c));
        }
    }

    static JsonValue parseObject(const std::string& json, size_t& pos) {
        pos++;
        JsonValue obj;
        obj.type = JsonValue::OBJECT_TYPE;

        skipWhitespace(json, pos);
        if (pos < json.size() && json[pos] == '}') {
            pos++;
            return obj;
        }

        while (pos < json.size()) {
            skipWhitespace(json, pos);
            if (pos >= json.size()) throw std::runtime_error("Unexpected end of input in object");
            if (json[pos] != '"') throw std::runtime_error("Expected \" in object key");

            std::string key = parseStringRaw(json, pos);
            skipWhitespace(json, pos);
            if (pos >= json.size() || json[pos] != ':') throw std::runtime_error("Expected ':' after object key");
            pos++;

            JsonValue value = parseValue(json, pos);
            obj.object_value[key] = value;

            skipWhitespace(json, pos);
            if (pos >= json.size()) throw std::runtime_error("Unexpected end of input in object");
            if (json[pos] == '}') {
                pos++;
                return obj;
            } else if (json[pos] != ',') {
                throw std::runtime_error("Expected ',' or '}' in object");
            }
            pos++;
        }

        throw std::runtime_error("Unexpected end of input in object");
    }

    static JsonValue parseArray(const std::string& json, size_t& pos) {
        pos++;
        JsonValue arr;
        arr.type = JsonValue::ARRAY_TYPE;

        skipWhitespace(json, pos);
        if (pos < json.size() && json[pos] == ']') {
            pos++;
            return arr;
        }

        while (pos < json.size()) {
            JsonValue value = parseValue(json, pos);
            arr.array_value.push_back(value);

            skipWhitespace(json, pos);
            if (pos >= json.size()) throw std::runtime_error("Unexpected end of input in array");
            if (json[pos] == ']') {
                pos++;
                return arr;
            } else if (json[pos] != ',') {
                throw std::runtime_error("Expected ',' or ']' in array");
            }
            pos++;
        }

        throw std::runtime_error("Unexpected end of input in array");
    }

    static JsonValue parseString(const std::string& json, size_t& pos) {
        std::string str = parseStringRaw(json, pos);
        return JsonValue(str);
    }

    static std::string parseStringRaw(const std::string& json, size_t& pos) {
        pos++;
        std::string str;
        while (pos < json.size()) {
            char c = json[pos];
            if (c == '"') {
                pos++;
                return str;
            } else if (c == '\\') {
                pos++;
                if (pos >= json.size()) throw std::runtime_error("Unexpected end of input in string");
                char esc = json[pos];
                switch (esc) {
                    case '"': str += '"'; break;
                    case '\\': str += '\\'; break;
                    case '/': str += '/'; break;
                    case 'b': str += '\b'; break;
                    case 'f': str += '\f'; break;
                    case 'n': str += '\n'; break;
                    case 'r': str += '\r'; break;
                    case 't': str += '\t'; break;
                    case 'u':
                        pos++;
                        if (pos + 3 >= json.size()) throw std::runtime_error("Invalid unicode escape");
                        // 简单处理，实际应该解析unicode
                        str += '?';
                        pos += 3;
                        break;
                    default:
                        throw std::runtime_error("Invalid escape sequence");
                }
            } else {
                str += c;
            }
            pos++;
        }
        throw std::runtime_error("Unexpected end of input in string");
    }

    static JsonValue parseBoolean(const std::string& json, size_t& pos) {
        if (json.substr(pos, 4) == "true") {
            pos += 4;
            return JsonValue(true);
        } else if (json.substr(pos, 5) == "false") {
            pos += 5;
            return JsonValue(false);
        } else {
            throw std::runtime_error("Invalid boolean value");
        }
    }

    static JsonValue parseNull(const std::string& json, size_t& pos) {
        if (json.substr(pos, 4) == "null") {
            pos += 4;
            return JsonValue();
        } else {
            throw std::runtime_error("Invalid null value");
        }
    }

    static JsonValue parseNumber(const std::string& json, size_t& pos) {
        size_t start = pos;
        while (pos < json.size() && (std::isdigit(json[pos]) || json[pos] == '.' || json[pos] == 'e' || json[pos] == 'E' || json[pos] == '-' || json[pos] == '+')) {
            pos++;
        }
        std::string numStr = json.substr(start, pos - start);
        std::istringstream iss(numStr);
        double num;
        if (!(iss >> num)) {
            throw std::runtime_error("Invalid number: " + numStr);
        }
        return JsonValue(num);
    }
};

class JsonSerializer {
public:
    static std::string serialize(const JsonValue& value) {
        std::stringstream ss;
        serializeValue(value, ss);
        return ss.str();
    }

private:
    static void serializeValue(const JsonValue& value, std::stringstream& ss) {
        switch (value.getType()) {
            case JsonValue::NULL_TYPE:
                ss << "null";
                break;
            case JsonValue::BOOL_TYPE:
                ss << (value.asBool() ? "true" : "false");
                break;
            case JsonValue::NUMBER_TYPE:
                ss << value.asNumber();
                break;
            case JsonValue::STRING_TYPE:
                serializeString(value.asString(), ss);
                break;
            case JsonValue::ARRAY_TYPE:
                serializeArray(value.asArray(), ss);
                break;
            case JsonValue::OBJECT_TYPE:
                serializeObject(value.asObject(), ss);
                break;
        }
    }

    static void serializeString(const std::string& str, std::stringstream& ss) {
        ss << '"';
        for (char c : str) {
            switch (c) {
                case '"': ss << '\\' << '"'; break;
                case '\\': ss << '\\' << '\\'; break;
                case '/': ss << '\\' << '/'; break;
                case '\b': ss << '\\' << 'b'; break;
                case '\f': ss << '\\' << 'f'; break;
                case '\n': ss << '\\' << 'n'; break;
                case '\r': ss << '\\' << 'r'; break;
                case '\t': ss << '\\' << 't'; break;
                default:
                    ss << c;
                    break;
            }
        }
        ss << '"';
    }

    static void serializeArray(const std::vector<JsonValue>& arr, std::stringstream& ss) {
        ss << '[';
        for (size_t i = 0; i < arr.size(); i++) {
            if (i > 0) ss << ", ";
            serializeValue(arr[i], ss);
        }
        ss << ']';
    }

    static void serializeObject(const std::map<std::string, JsonValue>& obj, std::stringstream& ss) {
        ss << '{';
        size_t i = 0;
        for (const auto& pair : obj) {
            if (i > 0) ss << ", ";
            serializeString(pair.first, ss);
            ss << ": ";
            serializeValue(pair.second, ss);
            i++;
        }
        ss << '}';
    }
};

} // namespace minijson

#endif // MINIJSON_HPP
