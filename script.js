document.addEventListener('DOMContentLoaded', function() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            
            // 移除所有标签按钮的active类
            tabBtns.forEach(b => b.classList.remove('active'));
            // 添加当前按钮的active类
            this.classList.add('active');
            
            // 隐藏所有标签面板
            tabPanels.forEach(panel => panel.classList.remove('active'));
            // 显示目标标签面板
            document.getElementById(targetTab).classList.add('active');
        });
    });
});