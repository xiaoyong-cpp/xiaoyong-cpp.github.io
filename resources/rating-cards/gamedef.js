let gameState = {
    round: 0,
    currentTerm: 0,
    cards: [],
    card_explorer: {},
    effect_explorer: {},
    effects: [],
    playerMind: 0.75,
    playerCoding: 0.75,
    playerMood: 0.75,
    playerMental: 0.75,
    playerCulture: 0.75,
    playerHealth: 1.0,
    // 昼夜系统
    day: 1,
    timeOfDay: "day", // day 或 night
    gameTick: 0, // 每个昼夜各有3个gametick
    maxGameTickPerDay: 3,
    maxGameTickPerNight: 3,
}

const prettyPassLine = { // 及格线标准
    "csp-j": {
        "first": {
            "name": "一等奖",
            "score": 250,
        },
        "second": {
            "name": "二等奖",
            "score": 200,
        },
        "third": {
            "name": "三等奖",
            "score": 100,
        },
        "none": "没有获奖"
    }, 
    "csp-s": {
        "first": {
            "name": "一等奖",
            "score": 170,
        },
        "second": {
            "name": "二等奖",
            "score": 120,
        },
        "third": {
            "name": "三等奖",
            "score": 70,
        },
        "none": "没有获奖"
    },
    "noip": {
        "first": {
            "name": "一等奖",
            "score": 200,
        },
        "second": {
            "name": "二等奖",
            "score": 150,
        },
        "third": {
            "name": "三等奖",
            "score": 100,
        },
        "none": "没有获奖"
    },
    "provincial-exam": {
        "pro-team-A": {
            "name": "省选A队",
            "score": 400,
        },
        "pro-team-B": {
            "name": "省选B队",
            "score": 350,
        },
        "none": "没有进队"
    },
    "noi": {
        "gold": {
            "name": "金牌",
            "score": 200,
        },
        "silver": {
            "name": "银牌",
            "score": 150,
        },
        "bronze": {
            "name": "铜牌",
            "score": 100,
        },
        "none": "没有获奖"
    },
    "ioi": {
        "gold": {
            "name": "金牌",
            "score": 250,
        },
        "silver": {
            "name": "银牌",
            "score": 200,
        },
        "bronze": {
            "name": "铜牌",
            "score": 150,
        },
        "none": "铁牌"
    },
    "culture-exam": {
        "A": {
            "name": "优秀",
            "score": 637.5,
        },
        "B": {
            "name": "良好",
            "score": 525,
        },
        "C": {
            "name": "及格",
            "score": 450,
        },
        "none": "不及格"
    }
}