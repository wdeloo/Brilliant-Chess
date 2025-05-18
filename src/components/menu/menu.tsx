"use client"

import { useContext, useEffect, useRef, useState } from "react"
import { AnalyzeContext } from "@/context/analyze"

import Lens from "../svg/lens"
import Form from "./analyze/form"
import Loading from "./loading/loading"
import GameButtons from "./analysis/gameButtons"
import Pawn from "../svg/pawn"
import SelectChessComGame from "./analyze/selectChessCom"
import Star from "../svg/star"
import BoardIcon from "../svg/boardIcon"
import Summary from "./analysis/summary/summary"
import Moves from "./analysis/moves/moves"
import getOverallGameComment from "./analysis/moves/overallGameComment"
import SelectLichessOrgGame from "./analyze/selectLichessOrg"

export type platform = "chessCom" | "lichessOrg"

export default function Menu() {
    const [username, setUsername] = useState<{platform: platform, username: string}>({platform: "chessCom", username: ""})

    const [selected, select] = useState(0)

    const [overallGameComment, setOverallGameComment] = useState("")

    const analyzeContext = useContext(AnalyzeContext)

    const [tab, setTab] = analyzeContext.tab
    const [pageState] = analyzeContext.pageState
    const [data, setData] = analyzeContext.data
    const [game] = analyzeContext.game
    const [players] = analyzeContext.players
    const [result] = analyzeContext.result
    const [moveNumber, setMoveNumber] = analyzeContext.moveNumber
    const [analyzeController] = analyzeContext.analyzeController
    const [analyzingMove] = analyzeContext.analyzingMove
    const setAnimation = analyzeContext.animation[1]
    const setForward = analyzeContext.forward[1]
    const [customLine] = analyzeContext.customLine
    const [returnedToNormalGame] = analyzeContext.returnedToNormalGame
    const [depth, setDepth] = analyzeContext.depth

    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (pageState === 'default') setTab('analyze')
        if (pageState === 'loading') setTab('analyze')
        if (pageState === 'analyze') setTab('summary')
    }, [pageState])

    useEffect(() => {
        if (pageState !== "default") return
        if (username.username) {
            setTab('selectGame')
        } else {
            setTab('analyze')
        }
    }, [username])

    const { format } = data

    useEffect(() => {
        if (pageState !== 'analyze') return
        setTab('moves')
    }, [moveNumber])

    useEffect(() => {
        const playerNames = players.map(player => player.name) as [ string, string ]
        setOverallGameComment(getOverallGameComment(playerNames, result))
    }, [players, result])

    function stopSelecting() {
        setUsername({platform: 'chessCom', username: ''})
    }

    interface Tab {
        label: string,
        state: typeof tab,
        icon: (className: string) => React.ReactNode,
        show: boolean,
        onClick: () => void
    }

    const tabs: Tab[] = [
        { label: `Analize${pageState === 'analyze' ? ' new' : ''} Game`, state: "analyze", icon: (className: string) => <Lens class={className} size={20} />, show: true, onClick: () => { if (pageState === 'analyze') setData({ format: "fen", string: "" }); if (tab === 'selectGame') stopSelecting() } },
        { label: "Choose Game", state: "selectGame", icon: (className: string) => <Pawn class={className} size={20} />, show: tab === 'selectGame', onClick: () => { } },
        { label: "Summary", state: "summary", icon: (className: string) => <Star class={className} size={20} />, show: pageState === 'analyze', onClick: () => { } },
        { label: "Moves", state: 'moves', icon: (className: string) => <BoardIcon class={className} size={20} />, show: pageState === 'analyze', onClick: () => { } }
    ]

    return (
        <div ref={menuRef} className="vertical:h-full w-full max-w-[500px] pb-8 vertical:pb-0 vertical:min-h-0 min-h-[600px] select-text bg-backgroundBox rounded-borderRoundness flex-grow vertical:max-w-[500px] vertical:min-w-[290px] flex flex-col gap-4 overflow-hidden">
            <menu className="flex flex-row relative select-none">
                {tabs.map((t, i) => {
                    if (!t.show) return

                    const isSelected = tab === t.state
                    return <button role="tab" key={i} onClick={() => { setTab(t.state); t.onClick() }} className={`w-full flex flex-col gap-1 group items-center py-2 text-sm outline-none ${isSelected ? 'text-foreground' : 'bg-backgroundBoxBoxDisabled text-foregroundGrey cursor-pointer transition-colors hover:text-foregroundHighlighted'}`}>{t.icon(isSelected ? "fill-foreground" : "fill-foregroundGrey transition-colors group-hover:fill-foregroundHighlighted")}{t.label}</button>
                })}
            </menu>
            <div className="overflow-y-auto h-full flex flex-col">
                {pageState === 'default' && tab === 'analyze' ? <Form setData={setData} selectGame={(username: string, platform: platform) => { setUsername({platform, username}) }} depth={[depth, setDepth]} selected={[selected, select]} /> : ''}
                {pageState === 'default' && tab === 'selectGame' && username.platform === "chessCom" && username.username ? <SelectChessComGame stopSelecting={stopSelecting} username={username.username} depth={depth} /> : ''}
                {pageState === 'default' && tab === 'selectGame' && username.platform === "lichessOrg" && username.username ? <SelectLichessOrgGame stopSelecting={stopSelecting} username={username.username} depth={depth} /> : ''}

                {pageState === 'loading' && tab === 'analyze' ? <Loading format={format} analyzeController={analyzeController} /> : ''}

                {pageState === 'analyze' && tab === 'summary' ? <Summary setAnimation={setAnimation} setForward={setForward} setMoveNumber={setMoveNumber} moveNumber={moveNumber} players={players} moves={game} container={menuRef.current as HTMLElement} /> : ''}
                {pageState === 'analyze' && tab === 'moves' ? <Moves container={menuRef.current as HTMLElement} moves={game} overallGameComment={overallGameComment} moveNumber={moveNumber} setMoveNumber={setMoveNumber} analyzingMove={analyzingMove} setAnimation={setAnimation} setForward={setForward} customLine={customLine} returnedToNormalGame={returnedToNormalGame} /> : ''}
            </div>
            {pageState === 'analyze' ? (
                <div className="flex-col gap-1 pb-1 items-center hidden vertical:flex">
                    <hr className="border-neutral-600 w-[85%]" />
                    <GameButtons />
                </div>
            ) : ''}
        </div>
    )
}