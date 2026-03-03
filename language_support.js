// 语言包
        const translations = {
            zh: {
                title: '欢迎来到我的网站',
                description: '这是一个多语言示例',
                'action-btn': '点击我'
            },
            en: {
                title: 'Welcome to My Website',
                description: 'This is a multi-language example',
                'action-btn': 'Click Me'
            }
        };

        function switchLanguage(lang) {
            const elements = translations[lang];
            for (let id in elements) {
                const element = document.getElementById(id);
                if (element) {
                    element.textContent = elements[id];
                }
            }
            // 保存语言选择
            localStorage.setItem('preferred-language', lang);
        }

        // 加载保存的语言设置
        window.onload = function() {
            const savedLang = localStorage.getItem('preferred-language') || 'zh';
            switchLanguage(savedLang);
        };