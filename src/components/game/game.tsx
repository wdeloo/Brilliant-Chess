"use client"

import React, { useEffect, useState, useRef, useContext } from "react"

import Board, { drag, gameStartSound } from "./board"
import Clock from "./clock"
import Name from "./name"
import Evaluation from "./evaluation"
import { AnalyzeContext, CustomLine } from "@/context/analyze"
import { formatSquare, getCastle, invertColor, move, openings, parseMove, parsePGN, parsePosition, prepareStockfish, result, square } from "@/engine/stockfish"
import { Chess, PieceSymbol, WHITE } from "chess.js"
import { getAproxMemory, wasmSupported, wasmThreadsSupported } from "@/engine/wasmChecks"
import { pushPageWarning, pushPageError } from "@/components/errors/pageErrors"
import { ErrorsContext } from "@/context/errors"
import { maxVertical, navTop } from "../../../tailwind.config"
import { ConfigContext } from "@/context/config"

// const NOT_SUPPORTED_WASM_THREADS_WARNING = ['WebAssembly threads not supported', 'The app may run slower. Try updating your browser for better performance.']
const NOT_SUPPORTED_WASM_WARNING = ['WebAssembly not supported', 'The app may run very slow. Try updating your browser for better performance.']

export type arrow = square[]
export interface AllGameArrows { [key: number]: arrow[] }

export function getMoves(game: move[], moveNumber: number, customLine: CustomLine, returnedToNormalGame: square[] | null) {
    const previousMove = (() => {
        if (customLine.moveNumber === 0) {
            return game[moveNumber]
        }
        if (customLine.moveNumber > 0) {
            return customLine.moves[customLine.moveNumber - 1]
        }
        return game[moveNumber - 1]
    })()

    const move = (() => {
        if (customLine.moveNumber >= 0) {
            return customLine.moves[customLine.moveNumber]
        }
        return game[moveNumber]
    })()

    const nextMove = (() => {
        if (customLine.moveNumber >= 0) {
            return customLine.moves[customLine.moveNumber + 1]
        }
        if (returnedToNormalGame) {
            return { ...game[moveNumber], movement: returnedToNormalGame }
        }
        return game[moveNumber + 1]
    })()

    return { previousMove, move, nextMove }
}

function getArrows(arrows: AllGameArrows, moveNumber: number, customLine: CustomLine) {
    if (customLine.moveNumber < 0) {
        return arrows[moveNumber]
    }
    return customLine.arrows[customLine.moveNumber]
}

function getCustomResult(move?: move): result {
    if (!move) return ""

    const chess = new Chess(move.fen)
    const color = move.color

    if (chess.isCheckmate()) return color === WHITE ? "0-1" : "1-0"
    if (chess.isDraw()) return "1/2-1/2"
    return ""
}

export default function Game() {
    const [boardSize, setBoardSize] = useState(750)
    const [gameHeight, setGameHeight] = useState(850)
    const [captured, setCaptured] = useState<{ white: PieceSymbol[], black: PieceSymbol[] }>({ white: [], black: [] })
    const [arrows, setArrows] = useState<AllGameArrows>({0: []})
    const [gap, setGap] = useState(10)
    const [openings, setOpenings] = useState<openings>({ })
    const [drag, setDrag] = useState<drag>({is: false, id: ''})
    const [isNavTop, setIsNavTop] = useState(false)

    const analyzeContext = useContext(AnalyzeContext)
    const errorsContext = useContext(ErrorsContext)
    const configContext = useContext(ConfigContext)

    const [players, setPlayers] = analyzeContext.players
    const [time, setTime] = analyzeContext.time
    const [moveNumber, setMoveNumber] = analyzeContext.moveNumber
    const [game, setGame] = analyzeContext.game
    const [data] = analyzeContext.data
    const [pageState, setPageState] = analyzeContext.pageState
    const [forward, setForward] = analyzeContext.forward
    const [animation, setAnimation] = analyzeContext.animation
    const [white, setWhite] = analyzeContext.white
    const [playing, setPlaying] = analyzeContext.playing
    const [materialAdvantage] = analyzeContext.materialAdvantage
    const [result, setResult] = analyzeContext.result
    const setProgress = analyzeContext.progress[1]
    const [tab, setTab] = analyzeContext.tab
    const [analyzeController, setAnalyzeController] = analyzeContext.analyzeController
    const [customLine, setCustomLine] = analyzeContext.customLine
    const [returnedToNormalGame] = analyzeContext.returnedToNormalGame
    const [analyzingMove, setAnalyzingMove] = analyzeContext.analyzingMove
    const [depth] = analyzeContext.depth
    const setMaterialAdvantage = analyzeContext.materialAdvantage[1]

    const gameController = analyzeContext.gameController

    const setErrors = errorsContext.errors[1]

    const [boardSounds] = configContext.boardSounds

    const componentRef = useRef<HTMLDivElement>(null)
    const gameRef = useRef<HTMLDivElement>(null)

    const intervalRef = useRef<NodeJS.Timeout>()
    const tabRef = useRef(tab)

    const dragRef = useRef(drag)

    const engineWorkerRef = useRef<Worker | null>(null)

    const analyzingMoveRef = useRef<boolean>(analyzingMove)

    const { previousMove, move, nextMove } = getMoves(game, moveNumber, customLine, returnedToNormalGame)
    const shownResult = customLine.moveNumber < 0 ? result : getCustomResult(move)

    useEffect(() => {
        analyzingMoveRef.current = analyzingMove
    }, [analyzingMove])

    useEffect(() => {
        dragRef.current = drag
    }, [drag])

    useEffect(() => {
        (async () => {
            const openingsRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/openings/openings.json`)
            const openings = await openingsRes.json()
            setOpenings(openings as openings)
        })()
    }, [])

    useEffect(() => {
        if (!wasmThreadsSupported()) {
            if (!wasmSupported()) {
                // Web Assembly not Supported
                pushPageWarning(setErrors, NOT_SUPPORTED_WASM_WARNING[0], NOT_SUPPORTED_WASM_WARNING[1])
                engineWorkerRef.current = new window.Worker(`${process.env.NEXT_PUBLIC_BASE_PATH}/engine/stockfish-asm.js`)
            } else {
                // Web Assembly Threads not Supported
                // pushPageWarning(setErrors, NOT_SUPPORTED_WASM_THREADS_WARNING[0], NOT_SUPPORTED_WASM_THREADS_WARNING[1])
                engineWorkerRef.current = new window.Worker(`${process.env.NEXT_PUBLIC_BASE_PATH}/engine/stockfish-single.js`)
            }
        } else {
            // Supported
            engineWorkerRef.current = new window.Worker(`${process.env.NEXT_PUBLIC_BASE_PATH}/engine/stockfish.js`)
        }

        const stockfish = engineWorkerRef.current

        const threads = navigator.hardwareConcurrency ?? 1
        const hash = Math.floor(getAproxMemory() / 4)

        const errorTimeout = setTimeout(() => pushPageError(setErrors, 'The browser is having some troubles loading Stockfish', "If the app doesn't work properly try restarting the browser."), 15000);
        (async () => {
            await prepareStockfish(stockfish, threads, hash)
            clearTimeout(errorTimeout)
        })()

        return () => clearTimeout(errorTimeout)
    }, [])

    useEffect(() => {
        setAnimation(false)
    }, [moveNumber, customLine.moveNumber])

    useEffect(() => {
        tabRef.current = tab
    }, [tab])

    useEffect(() => {
        clearInterval(intervalRef.current)
        if (playing) {
            function nextMove() {
                gameController.forward()
            }
            nextMove()
            intervalRef.current = setInterval(nextMove, 1000)
        } else {
            clearInterval(intervalRef.current)
        }

        return () => clearInterval(intervalRef.current)
    }, [playing])

    function createArrowsObject(length: number) {
        const newArrows: AllGameArrows = {}
        Array.from({ length }).forEach((_, i) => {
            newArrows[i] = []
        })

        return newArrows
    }

    function cleanArrows() {
        setArrows({ 0: [] })
    }

    function cleanCurrentArrows() {
        if (customLine.moveNumber < 0) {
            setArrows(prev => {return {...prev, [moveNumber]: []}})
        } else {
            setCustomLine(prev => ({ ...prev, arrows: { ...prev.arrows, [prev.moveNumber]: [] } }))
        }
    }

    function pushArrow(currentArrow: arrow) {
        if (customLine.moveNumber < 0) {
            const repeatedIndex = arrows[moveNumber].findIndex(arrow => JSON.stringify(arrow) === JSON.stringify(currentArrow))
            const isRepeated = repeatedIndex !== -1

            const newArrows = [...arrows[moveNumber]]

            if (isRepeated) {
                newArrows.splice(repeatedIndex, 1)
            } else {
                newArrows.push(currentArrow)
            }

            setArrows(prev => {return {...prev, [moveNumber]: newArrows}})
        } else {
            const repeatedIndex = customLine.arrows[customLine.moveNumber].findIndex(arrow => JSON.stringify(arrow) === JSON.stringify(currentArrow))
            const isRepeated = repeatedIndex !== -1

            const newArrows = [...customLine.arrows[customLine.moveNumber]]

            if (isRepeated) {
                newArrows.splice(repeatedIndex, 1)
            } else {
                newArrows.push(currentArrow)
            }

            setCustomLine(prev => ({ ...prev, arrows: { ...prev.arrows, [customLine.moveNumber]: newArrows } }))
        }
    }

    useEffect(() => {
        let lastPressed = 0
        function handleKeyDown(e: KeyboardEvent) {
            const element = e.target as HTMLElement
            const focusableInputTypes = ['text', 'number', 'password', 'email', 'search', 'tel', 'url']
            if (element.tagName === 'INPUT' && focusableInputTypes.includes(element.getAttribute('type') ?? '')) return
            if (element.tagName === 'TEXTAREA') return

            const now = new Date().getTime()
            const minPressInterval = 25

            switch (e.key) {
                case 'ArrowLeft':
                    e.preventDefault()
                    if (dragRef.current.is) return
                    if (now - lastPressed < minPressInterval) return
                    if (analyzingMoveRef.current) return

                    gameController.back()

                    lastPressed = new Date().getTime()
                    break
                case 'ArrowRight':
                    e.preventDefault()
                    if (dragRef.current.is) return
                    if (now - lastPressed < minPressInterval) return
                    if (analyzingMoveRef.current) return

                    gameController.forward()

                    lastPressed = new Date().getTime()
                    break
                case 'ArrowUp':
                    e.preventDefault()
                    if (dragRef.current.is) return
                    if (now - lastPressed < minPressInterval) return
                    if (analyzingMoveRef.current) return

                    gameController.first()

                    lastPressed = new Date().getTime()
                    break
                case 'ArrowDown':
                    e.preventDefault()
                    if (dragRef.current.is) return
                    if (now - lastPressed < minPressInterval) return
                    if (analyzingMoveRef.current) return

                    gameController.last()

                    lastPressed = new Date().getTime()
                    break
                case ' ':
                    e.preventDefault()
                    if (dragRef.current.is) return
                    if (now - lastPressed < minPressInterval) return
                    if (analyzingMoveRef.current) return

                    gameController.togglePlay()

                    lastPressed = new Date().getTime()
                    break
                case 'Tab':
                    e.preventDefault()
                    if (now - lastPressed < minPressInterval) return

                    const tab = tabRef.current

                    if (pageState === "analyze") {
                        if (tab === 'summary') setTab('moves')
                        else if (tab === 'moves') setTab('summary')
                    }
                    break
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    async function handlePGN(pgn: string, depth: number) {
        const PGN_ERROR = ['Error reading PGN', 'Please, provide a valid PGN.']

        setPageState('loading')

        if (!pgn) {
            pushPageError(setErrors, PGN_ERROR[0], PGN_ERROR[1])
            setPageState('default')
            return
        }

        if (!wasmThreadsSupported()) {
            if (!wasmSupported()) {
                pushPageWarning(setErrors, NOT_SUPPORTED_WASM_WARNING[0], NOT_SUPPORTED_WASM_WARNING[1])
            } else {
                // pushPageWarning(setErrors, NOT_SUPPORTED_WASM_THREADS_WARNING[0], NOT_SUPPORTED_WASM_THREADS_WARNING[1])
            }
        }

        const stockfish = engineWorkerRef.current
        if (!stockfish) return

        try {
            const { metadata, moves } = await parsePGN(stockfish, pgn, depth, openings, setProgress, analyzeController.signal)

            setTime(metadata.time)
            setPlayers(metadata.players)
            setGame(moves)
            setResult(metadata.result)
            setAnimation(false)
            setArrows(createArrowsObject(moves.length))
            setCustomLine({ moveNumber: -1, moves: [], arrows: {} })
            setAnalyzingMove(false)

            if (boardSounds) setTimeout(() => gameStartSound.play(), 100)
            setPageState('analyze')
        } catch (e: any) {
            switch (e.message) {
                case 'pgn':
                    pushPageError(setErrors, PGN_ERROR[0], PGN_ERROR[1])
                    break
                case 'canceled':
                    setAnalyzeController(new AbortController())
                    break
            }

            setPageState('default')
        }

        setProgress(0)
        setMoveNumber(0)
    }

    async function handleFEN(fen: string) {
        const FEN_ERROR = ['Error reading FEN', 'Please, provide a valid FEN.']

        let move
        try {
            move = await new Promise<move>(async (resolve, reject) => {
                setPageState('loading')

                setTime(0)
                setPlayers([{ name: 'White', elo: '?' }, { name: 'Black', elo: '?' }])
                setWhite(true)
                setPlaying(false)
                setMoveNumber(0)
                setResult("")
                setProgress(0)
                setCustomLine({ moveNumber: -1, moves: [], arrows: {} })
                setAnalyzingMove(false)
                cleanArrows()

                if (!fen) {
                    const chess = new Chess()
                    const fen = chess.fen()
                    const bestMove = chess.move({ from: "e2", to: "e4" })

                    const move: move = {
                        fen,
                        color: chess.turn(),
                        bestMove: [formatSquare(bestMove.from), formatSquare(bestMove.to)],
                        bestMoveSan: bestMove.san,
                        previousStaticEvals: [["cp", "-30"]]
                    }

                    setGame([move])
                    setPageState('default')
                    return
                }

                const stockfish = engineWorkerRef.current
                if (!stockfish) return

                let chess
                try {
                    chess = new Chess(fen)
                } catch {
                    reject(new Error("fen"))
                    return
                }
                const signal = analyzeController.signal

                function handleAbort() {
                    reject(new Error('canceled'))
                    signal.removeEventListener('abort', handleAbort)
                }

                const move = await parsePosition(stockfish, chess, depth, signal, handleAbort)

                resolve(move)
            })
        } catch (e: any) {
            switch (e.message) {
                case 'fen':
                    pushPageError(setErrors, FEN_ERROR[0], FEN_ERROR[1])
                    break
                case 'canceled':
                    setAnalyzeController(new AbortController())
                    break
            }

            setPageState('default')
            return
        }

        setGame([move])
        setPageState('analyzeCustom')
    }

    useEffect(() => {
        const { format, string } = data
        switch (format) {
            case "pgn":
                handlePGN(string, depth)
                break
            case "fen":
                handleFEN(string)
                break
        }
    }, [data])

    useEffect(() => {
        function updateBoardSize() {
            const newGap = window.innerWidth < maxVertical ? 6 : 10
            setGap(newGap)

            const component = componentRef.current
            const statusBar = component?.getElementsByTagName('div')[0]

            const componentHeight = component?.offsetHeight ?? 0
            const statusBarHeight = statusBar?.offsetHeight ?? 0
            const gapHeight = newGap

            const nav = document.getElementsByTagName("nav")[0]
            const navWidth = nav?.offsetWidth ?? 0
            const navHeight = nav?.offsetHeight ?? 0
            const evalWidth = 36
            const menuWidth = 400
            const boardMenuWidth = 17
            const gapWidth = 8
            const paddingWidth = 16

            const isNavTop = window.innerWidth < navTop
            setIsNavTop(isNavTop)

            if (isNavTop) {
                const paddingWidth = 8

                const boardHeight = window.innerHeight - (navHeight + paddingWidth + evalWidth + gapWidth + statusBarHeight + gapWidth + gapWidth + statusBarHeight + gapHeight + boardMenuWidth + paddingWidth)
                const maxWidth = window.innerWidth - (paddingWidth + paddingWidth)

                const newBoardSize = roundBoardSize(Math.min(boardHeight, maxWidth))

                setBoardSize(newBoardSize)
                setGameHeight(newBoardSize)

                return
            }
            
            if (window.innerWidth < maxVertical) {
                const paddingWidth = 8
                const evalWidth = 28

                const boardHeight = window.innerHeight - ((statusBarHeight * 2) + (gapHeight * 2) + (paddingWidth * 2))
                const maxWidth = window.innerWidth - (navWidth + paddingWidth + evalWidth + gapHeight + gapWidth + boardMenuWidth + paddingWidth)

                const newBoardSize = roundBoardSize(Math.min(boardHeight, maxWidth))

                setBoardSize(newBoardSize)
                setGameHeight(newBoardSize + (statusBarHeight * 2) + (gapHeight * 2))

                return
            }

            const boardHeight = componentHeight - ((statusBarHeight * 2) + (gapHeight * 2))
            const maxWidth = window.innerWidth - (navWidth + paddingWidth + evalWidth + gapHeight + gapWidth + boardMenuWidth + gapWidth + menuWidth + paddingWidth)

            const newBoardSize = roundBoardSize(Math.min(boardHeight, maxWidth))

            setBoardSize(newBoardSize)
            setGameHeight(newBoardSize + (statusBarHeight * 2) + (gapHeight * 2))
        }

        updateBoardSize()

        window.addEventListener('resize', updateBoardSize)

        return () => window.removeEventListener('resize', updateBoardSize)
    }, [])

    useEffect(() => {
        const newCaptured: typeof captured = { white: [], black: [] }
        for (let i = 0; i <= moveNumber && i < game.length; i++) {
            const move = game[i]
            if (move.capture) newCaptured[move.color === 'w' ? 'black' : 'white'].push(move.capture)
        }
        for (let i = 0; i <= customLine.moveNumber; i++) {
            const move = customLine.moves[i]
            if (move.capture) newCaptured[move.color === 'w' ? 'black' : 'white'].push(move.capture)
        }
        setCaptured(newCaptured)
    }, [moveNumber, customLine.moveNumber])

    function roundBoardSize(boardSize: number) {
        return Math.round(boardSize / 8) * 8
    }

    function sliceCustomArrows(arrows: AllGameArrows, moveNumber: number) {
        const newArrows: AllGameArrows = {}
        for (let i = 0; i <= moveNumber; i++) {
            if (!arrows[i]) newArrows[i] = []
            else newArrows[i] = arrows[i]
        }

        return newArrows
    }

    async function analyzeMove(previousFen: string, movement: { from: string, to: string, promotion?: PieceSymbol }, previousSacrifice: boolean, previousStaticEvals: string[][], animation: boolean, previousBestMoveSan?: string) {
        const chess = new Chess(previousFen)
        const unanalyzedMoveObj = chess.move(movement)

        const unanalyzedMove: move = {
            fen: unanalyzedMoveObj.after,
            movement: [formatSquare(movement.from), formatSquare(movement.to)],
            color: invertColor(unanalyzedMoveObj.color),
            capture: unanalyzedMoveObj.captured,
            castle: getCastle(unanalyzedMoveObj.san),
            san: unanalyzedMoveObj.san,
        }

        setAnimation(animation)
        setForward(true)
        setCustomLine(prev => ({ moveNumber: prev.moveNumber + 1, moves: [...prev.moves.slice(0, prev.moveNumber + 1), unanalyzedMove], arrows: sliceCustomArrows(prev.arrows, prev.moveNumber + 1) }))
        setAnalyzingMove(true)

        if (data.format === "fen") setPageState("analyzeCustom")

        const move = await new Promise<move>(async (resolve, reject) => {
            const signal = analyzeController.signal

            function handleAbort() {
                reject(new Error('canceled'))
                signal.removeEventListener('abort', handleAbort)
            }

            const stockfish = engineWorkerRef.current
            if (!stockfish) return

            const chess = new Chess(previousFen)
            const move = chess.move(movement)

            const analyzedMovement = await parseMove(stockfish, depth, move, chess, previousStaticEvals, previousBestMoveSan, previousSacrifice, openings, handleAbort, signal)
            resolve(analyzedMovement)
        })

        setAnimation(false)
        setAnalyzingMove(false)
        setCustomLine(prev => ({ ...prev, moveNumber: prev.moveNumber, moves: [...prev.moves.slice(0, prev.moveNumber), move] }))
    }

    function formatTime(seconds: number): string {
        const noTime = '--:--'

        const toTwoDigits = (num: number) => {
            return String(num).padStart(2, '0')
        }

        const getMinutes = (seconds: number) => {
            return [Math.floor(seconds / 60), seconds % 60]
        }

        const getHours = (minutes: number) => {
            return Math.ceil(minutes / 60)
        }

        const getDays = (hours: number) => {
            return Math.ceil(hours / 24)
        }

        const [minutes, restSeconds] = getMinutes(seconds)

        if (minutes) {
            const hours = getHours(minutes)
            if (hours > 2) {
                const days = getDays(hours)
                if (days > 2) {
                    return `${days} days`
                }
                return `${hours} ${hours > 1 ? 'hours' : 'hour'}`
            }
            return `${toTwoDigits(minutes)}:${toTwoDigits(restSeconds)}`
        }
        if (restSeconds) return `${toTwoDigits(minutes)}:${toTwoDigits(restSeconds)}`
        return noTime
    }

    return (
        <div ref={gameRef} tabIndex={0} style={{ gap: gap }} className="h-full flex navTop:flex-row flex-col outline-none">
            <div style={{ [isNavTop ? "width" : "height"]: gameHeight }} className="flex navTop:flex-row flex-col items-center">
                <Evaluation size={boardSize} navTop={isNavTop} white={white} advantage={analyzingMove ? previousMove?.previousStaticEvals?.[0] ?? ["cp", "0"] : move?.previousStaticEvals?.[0] ?? ['cp', "0"]} whiteMoving={(analyzingMove ? previousMove?.color ?? WHITE : move?.color ?? WHITE) === WHITE} />
            </div>
            <div ref={componentRef} style={{ gap: gap }} className="h-full flex flex-col justify-start">
                <div style={{ width: boardSize }} className="flex flex-row justify-between">
                    <Name materialAdvantage={materialAdvantage} captured={captured[white ? 'black' : 'white']} white={!white}>{`${players[white ? 1 : 0].name} ${players[white ? 1 : 0].elo !== 'NOELO' ? `(${players[white ? 1 : 0].elo})` : ''}`}</Name>
                    <Clock white={!white} colorMoving={game[moveNumber]?.color}>{formatTime(time)}</Clock>
                </div>
                <Board
                    setPlaying={setPlaying}
                    cleanArrows={cleanCurrentArrows}
                    arrows={getArrows(arrows, moveNumber, customLine)}
                    sacrifice={move?.sacrifice}
                    controller={gameController}
                    forward={forward}
                    moveRating={move?.moveRating}
                    bestMove={move?.bestMove}
                    previousBestMove={previousMove?.bestMove}
                    move={move?.movement}
                    nextMove={nextMove?.movement}
                    fen={move?.fen}
                    nextFen={nextMove?.fen}
                    boardSize={boardSize}
                    white={white}
                    animation={animation}
                    gameEnded={(moveNumber === game.length - 1 && customLine.moveNumber < 0) || (customLine.moveNumber >= 0 && Boolean(shownResult))}
                    capture={move?.capture}
                    nextCapture={nextMove?.capture}
                    castle={move?.castle}
                    nextCastle={nextMove?.castle}
                    setAnimation={setAnimation}
                    result={shownResult}
                    pushArrow={pushArrow}
                    analyzeMove={analyzeMove}
                    previousStaticEvals={move?.previousStaticEvals}
                    analyzingMove={analyzingMove}
                    setMaterialAdvantage={setMaterialAdvantage}
                    drag={drag}
                    setDrag={setDrag}
                    bestMoveSan={move?.bestMoveSan}
                />
                <div style={{ width: boardSize }} className="flex flex-row justify-between">
                    <Name materialAdvantage={materialAdvantage} captured={captured[white ? 'white' : 'black']} white={white}>{`${players[white ? 0 : 1].name} ${players[white ? 0 : 1].elo !== 'NOELO' ? `(${players[white ? 0 : 1].elo})` : ''}`}</Name>
                    <Clock white={white} colorMoving={game[moveNumber]?.color}>{formatTime(time)}</Clock>
                </div>
            </div>
        </div>
    )
}