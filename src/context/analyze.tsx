"use client"

import { move, result } from "@/engine/stockfish"
import { createContext, useState, Dispatch, SetStateAction, useRef, useEffect } from 'react'

export type players = {
    name: string;
    elo: string;
}[]

export interface Data {
    format: "pgn" | "fen",
    string: string,
    depth: number,
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

interface CustomLine {
    moveNumber: number
    moves: move[]
}

type pageState = 'default' | 'loading' | 'analyze'

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
    returnedToNormalGame: [string|null, Dispatch<SetStateAction<string|null>>]
    gameController: Controller,
}>({
    data: [{format: "fen", string: "", depth: 18}, () => { }],
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
    result: ['1/2-1/2', () => { }],
    progress: [0, () => { }],
    tab: ['analyze', () => { }],
    analyzeController: [abortControllerInstance, () => { }],
    customLine: [{ moveNumber: 0, moves: [] }, () => { }],
    returnedToNormalGame: [null, () => { }],
    gameController: { back: () => { }, forward: () => { }, last: () => { }, first: () => { }, play: () => { }, pause: () => { }, togglePlay: () => { } },
})

export default function AnalyzeContextProvider(props: { children: React.ReactNode }) {
    const [data, setData] = useState<Data>({format: "fen", string: "", depth: 18})
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
    const [result, setResult] = useState<result>('1/2-1/2')
    const [progress, setProgress] = useState(0)
    const [tab, setTab] = useState<tabs>('analyze')
    const [analyzeController, setAnalyzeController] = useState<AbortController>(abortControllerInstance)
    const [customLine, setCustomLine] = useState<CustomLine>({ moveNumber: -1, moves: [] })
    const [returnedToNormalGame, setReturnedToNormalGame] = useState<string|null>(null)

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
                setReturnedToNormalGame(customLineRef.current.moves[0].san ?? null)
                setCustomLine({ moveNumber: -1, moves: [] })
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
                setReturnedToNormalGame(customLineRef.current.moves[0].san ?? null)
                setCustomLine({ moveNumber: -1, moves: [] })
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
        <AnalyzeContext.Provider value={{ data: [data, setData], pageState: [pageState, setPageState], game: [game, setGame], players: [players, setPlayers], moveNumber: [moveNumber, setMoveNumber], forward: [forward, setForward], white: [white, setWhite], animation: [animation, setAnimation], playing: [playing, setPlaying], time: [time, setTime], materialAdvantage: [materialAdvantage, setMaterialAdvantage], result: [result, setResult], progress: [progress, setProgress], tab: [tab, setTab], analyzeController: [analyzeController, setAnalyzeController], customLine: [customLine, setCustomLine], returnedToNormalGame: [returnedToNormalGame, setReturnedToNormalGame], gameController }}>
            {props.children}
        </AnalyzeContext.Provider>
    )
}