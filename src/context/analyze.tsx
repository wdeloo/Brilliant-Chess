"use client"

import { move, result } from "@/engine/stockfish"
import { createContext, useState, Dispatch, SetStateAction } from 'react'

export type players = {
    name: string;
    elo: string;
}[]

export interface Data {
    format: "pgn" | "fen",
    string: string,
    depth: number,
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

    return (
        <AnalyzeContext.Provider value={{ data: [data, setData], pageState: [pageState, setPageState], game: [game, setGame], players: [players, setPlayers], moveNumber: [moveNumber, setMoveNumber], forward: [forward, setForward], white: [white, setWhite], animation: [animation, setAnimation], playing: [playing, setPlaying], time: [time, setTime], materialAdvantage: [materialAdvantage, setMaterialAdvantage], result: [result, setResult], progress: [progress, setProgress], tab: [tab, setTab], analyzeController: [analyzeController, setAnalyzeController] }}>
            {props.children}
        </AnalyzeContext.Provider>
    )
}