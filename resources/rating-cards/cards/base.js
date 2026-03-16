import gameState from '../gamedef.js'

const CardQuality = {
    Common: '普通',
    Rare: '稀有',
    Epic: '传奇',
}

const CardType = {
    Train: '训练',
    Contest: '比赛',
    Culture: '文化课',
    Special: '特殊',
}

class Card {
    name = "#Unknown"
    description = ""
    effectDescription = "这张卡牌有错误，没有任何效果。"
    onCreate = () => {}
    onUse = () => {}
    type = CardType.Train
    icon = "unknown"
    quality = CardQuality.Common
    gameTickCost = 1 // 卡牌消耗的gametick
    availableTime = "both" // 可用时间：day, night, both
    constructor(name, desc, effDesc, icon, oncreate, onuse, quality = CardQuality.Common, type = CardType.Train, gameTickCost = 1, availableTime = "both") {
        this.name = name
        this.icon = icon
        this.description = desc
        this.effectDescription = effDesc
        this.quality = quality
        this.type = type
        this.onCreate = oncreate
        this.onUse = onuse
        this.gameTickCost = gameTickCost
        this.availableTime = availableTime
    }
    // 检查卡牌是否可以使用
    canUse() {
        // 检查时间是否合适
        if (this.availableTime !== "both" && this.availableTime !== gameState.timeOfDay) {
            return false
        }
        // 检查是否有足够的gametick
        if (gameState.timeOfDay === "day") {
            return gameState.gameTick + this.gameTickCost <= gameState.maxGameTickPerDay
        } else {
            return gameState.gameTick + this.gameTickCost <= gameState.maxGameTickPerNight
        }
    }
}

function registerCard(id, card) {
    gameState.card_explorer[id] = card
}