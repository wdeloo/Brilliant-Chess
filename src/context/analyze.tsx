"use client"

import { AllGameArrows } from "@/components/game/game";
import { move, result, square } from "@/engine/stockfish"
import { createContext, useState, Dispatch, SetStateAction, useRef, useEffect } from 'react'

export type players = {
    name: string;
    elo: string;
}[]

export interface Data {
    format: "pgn" | "fen",
    string: string,
}

export interface Controller {
    back: () => void
    forward: () => void
    first: () => void
    last: () => void
    play: () => void
    pause: () => void
    togglePlay: () => void
}

export interface CustomLine {
    moveNumber: number
    moves: move[]
    arrows: AllGameArrows
}

type pageState = 'default' | 'loading' | 'analyze' | 'analyzeCustom'

type tabs = 'analyze' | 'selectGame' | 'summary' | 'moves'

const abortControllerInstance = new AbortController()

export const AnalyzeContext = createContext<{
    data: [Data, Dispatch<SetStateAction<Data>>],
    pageState: [pageState, Dispatch<SetStateAction<pageState>>],
    game: [move[], Dispatch<SetStateAction<move[]>>],
    players: [players, Dispatch<SetStateAction<players>>],
    moveNumber: [number, Dispatch<SetStateAction<number>>],
    forward: [boolean, Dispatch<SetStateAction<boolean>>],
    animation: [boolean, Dispatch<SetStateAction<boolean>>],
    white: [boolean, Dispatch<SetStateAction<boolean>>],
    playing: [boolean, Dispatch<SetStateAction<boolean>>],
    time: [number, Dispatch<SetStateAction<number>>],
    materialAdvantage: [number, Dispatch<SetStateAction<number>>],
    result: [result, Dispatch<SetStateAction<result>>],
    progress: [number, Dispatch<SetStateAction<number>>],
    tab: [tabs, Dispatch<SetStateAction<tabs>>],
    analyzeController: [AbortController, Dispatch<SetStateAction<AbortController>>],
    customLine: [CustomLine, Dispatch<SetStateAction<CustomLine>>],
    returnedToNormalGame: [square[]|null, Dispatch<SetStateAction<square[]|null>>]
    analyzingMove: [boolean, Dispatch<SetStateAction<boolean>>],
    depth: [number, Dispatch<SetStateAction<number>>]
    gameController: Controller,
}>({
    data: [{format: "fen", string: ""}, () => { }],
    pageState: ["analyze", () => { }],
    game: [[], () => { }],
    players: [[], () => { }],
    moveNumber: [0, () => { }],
    forward: [true, () => { }],
    animation: [false, () => { }],
    white: [true, () => { }],
    playing: [false, () => { }],
    time: [0, () => { }],
    materialAdvantage: [0, () => { }],
    result: ['', () => { }],
    progress: [0, () => { }],
    tab: ['analyze', () => { }],
    analyzeController: [abortControllerInstance, () => { }],
    customLine: [{ moveNumber: -1, moves: [], arrows: {} }, () => { }],
    returnedToNormalGame: [null, () => { }],
    analyzingMove: [false, () => { }],
    depth: [18, () => { }],
    gameController: { back: () => { }, forward: () => { }, last: () => { }, first: () => { }, play: () => { }, pause: () => { }, togglePlay: () => { } },
})

export default function AnalyzeContextProvider(props: { children: React.ReactNode }) {
    const [data, setData] = useState<Data>({format: "fen", string: ""})
    const [pageState, setPageState] = useState<pageState>('default')
    const [game, setGame] = useState<move[]>([])
    const [players, setPlayers] = useState<players>([{ name: 'White', elo: '?' }, { name: 'Black', elo: '?' }])
    const [moveNumber, setMoveNumber] = useState(0)
    const [forward, setForward] = useState(true)
    const [animation, setAnimation] = useState(true)
    const [white, setWhite] = useState(true)
    const [playing, setPlaying] = useState(false)
    const [time, setTime] = useState(0)
    const [materialAdvantage, setMaterialAdvantage] = useState(0)
    const [result, setResult] = useState<result>('')
    const [progress, setProgress] = useState(0)
    const [tab, setTab] = useState<tabs>('analyze')
    const [analyzeController, setAnalyzeController] = useState<AbortController>(abortControllerInstance)
    const [customLine, setCustomLine] = useState<CustomLine>({ moveNumber: -1, moves: [], arrows: {} })
    const [returnedToNormalGame, setReturnedToNormalGame] = useState<square[]|null>(null)
    const [analyzingMove, setAnalyzingMove] = useState(false)
    const [depth, setDepth] = useState(18)

    const moveNumberRef = useRef(moveNumber)
    const customLineRef = useRef(customLine)
    const gameLengthRef = useRef(game.length)

    useEffect(() => {
        customLineRef.current = customLine
    }, [customLine])

    useEffect(() => {
        moveNumberRef.current = moveNumber
    }, [moveNumber])

    useEffect(() => {
        gameLengthRef.current = game.length
    }, [game.length])

    const gameController: Controller = {
        back: () => {
            if (customLineRef.current.moveNumber > 0) {
                setForward(false)
                setAnimation(true)
                setReturnedToNormalGame(null)
                setCustomLine(prev => ({ ...prev, moveNumber: prev.moveNumber - 1 }))
            } else if (customLineRef.current.moveNumber === 0) {
                setForward(false)
                setAnimation(true)
                setReturnedToNormalGame(customLineRef.current.moves[0].movement ?? null)
                setCustomLine({ moveNumber: -1, moves: [], arrows: {} })
            } else if (moveNumberRef.current > 0) {
                setForward(false)
                setAnimation(true)
                setReturnedToNormalGame(null)
                setMoveNumber(prev => prev - 1)
            }
        },
        forward: () => {
            setReturnedToNormalGame(null)
            if (customLineRef.current.moveNumber >= 0) {
                if (customLineRef.current.moveNumber < customLineRef.current.moves.length - 1) {
                    setForward(true)
                    setAnimation(true)
                    setCustomLine(prev => ({ ...prev, moveNumber: prev.moveNumber + 1 }))
                }
                return
            } else if (moveNumberRef.current < gameLengthRef.current - 1) {
                setForward(true)
                setAnimation(true)
                setMoveNumber(prev => prev + 1)
            }
        },
        first: () => {
            if (customLineRef.current.moveNumber >= 0) {
                setAnimation(false)
                setReturnedToNormalGame(customLineRef.current.moves[0].movement ?? null)
                setCustomLine({ moveNumber: -1, moves: [], arrows: {} })
            } else {
                setAnimation(false)
                setReturnedToNormalGame(null)
                setMoveNumber(0)
            }
        },
        last: () => {
            setReturnedToNormalGame(null)
            if (customLineRef.current.moveNumber >= 0) {
                setAnimation(false)
                setCustomLine(prev => ({ ...prev, moveNumber: prev.moves.length - 1 }))
            } else {
                setAnimation(false)
                setMoveNumber(gameLengthRef.current - 1)
            }
        },
        togglePlay: () => {
            setPlaying(prev => !prev)
        },
        play: () => {
            setPlaying(true)
        },
        pause: () => {
            setPlaying(false)
        }
    }

    return (
        <AnalyzeContext.Provider value={{ data: [data, setData], pageState: [pageState, setPageState], game: [game, setGame], players: [players, setPlayers], moveNumber: [moveNumber, setMoveNumber], forward: [forward, setForward], white: [white, setWhite], animation: [animation, setAnimation], playing: [playing, setPlaying], time: [time, setTime], materialAdvantage: [materialAdvantage, setMaterialAdvantage], result: [result, setResult], progress: [progress, setProgress], tab: [tab, setTab], analyzeController: [analyzeController, setAnalyzeController], customLine: [customLine, setCustomLine], returnedToNormalGame: [returnedToNormalGame, setReturnedToNormalGame], analyzingMove: [analyzingMove, setAnalyzingMove], depth: [depth, setDepth], gameController }}>
            {props.children}
        </AnalyzeContext.Provider>
    )
}