import { useContext, useEffect, useRef, useState } from "react";
import { AnalyzeContext } from "@/context/analyze";
import RatingCount from "./ratingCount";
import PlayersAccuracy from "./playersAccuracy";
import GameRating from "./gameRating";
import { accuracyPhases } from "./playersAccuracy";
import { move } from "@/engine/stockfish";
import GameChart from "../gameChart";
import { reduceSummary } from "../../../../../tailwind.config";

export default function Summary(props: { moves: move[], container: HTMLElement }) {
    const { moves, container } = props

    const [reducedSummary, setReducedSummary] = useState(false)

    const componentRef = useRef<HTMLDivElement>(null)

    const [accuracy, setAccuracy] = useState({ w: NaN, b: NaN })
    const [accuracyPhases, setAccuracyPhases] = useState<accuracyPhases>({ opening: { w: [], b: [] }, middlegame: { w: [], b: [] }, endgame: { w: [], b: [] } })

    const analyzeContext = useContext(AnalyzeContext)

    const [players, setPlayers] = analyzeContext.players

    useEffect(() => {
        const observer = new ResizeObserver(entries => {
            entries.forEach(() => {
                setReducedSummary(window.innerWidth < reduceSummary)
            })
        })

        const component = componentRef.current

        if (!component) return

        observer.observe(component)
    }, [])

    return (
        <div ref={componentRef} className="flex flex-col gap-3 items-center">
            <GameChart moves={moves} container={container} />
            <PlayersAccuracy reducedSummary={reducedSummary} setAccuracyPhases={setAccuracyPhases} accuracy={[accuracy, setAccuracy]} players={players} moves={moves} />
            <hr className="border-neutral-600 w-[85%]" />
            <RatingCount moves={moves} />
            <hr className="border-neutral-600 w-[85%]" />
            <GameRating reducedSummary={reducedSummary} accuracy={accuracy} accuracyPhases={accuracyPhases} />
        </div>
    )
}