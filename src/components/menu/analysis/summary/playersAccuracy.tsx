import { players } from "@/context/analyze";
import Profile from "../../../svg/profile";
import { move, position } from "@/server/analyze";
import { Dispatch, SetStateAction, useEffect } from "react";
import RatingBox from "./ratingBox";
import { Chess, Color } from "chess.js";

export interface accuracyPhases {
    opening: { w: number[], b: number[] },
    middlegame: { w: number[], b: number[] },
    endgame: { w: number[], b: number[] }
}

function isEndOpening(position: position) {
    let nonDeveloppedBlack = 0, nonDeveloppedWhite = 0
    for (const square of position[0]) {
        if (square?.color === 'w') continue
        if (square?.type === 'n' || square?.type === 'b' || square?.type === 'q') nonDeveloppedBlack++
    }
    for (const square of position[position.length - 1]) {
        if (square?.color === 'b') continue
        if (square?.type === 'n' || square?.type === 'b' || square?.type === 'q') nonDeveloppedWhite++
    }

    const developpedBlack = 5 - nonDeveloppedBlack
    const developpedWhite = 5 - nonDeveloppedWhite

    if (developpedBlack >= 3 && developpedWhite >= 2) return true
    if (developpedWhite >= 3 && developpedBlack >= 2) return true
    if (developpedBlack >= 4) return true
    if (developpedWhite >= 4) return true
}

function isEndMiddlegame(position: position) {
    let whitePieces = 0, blackPieces = 0
    for (const row of position) {
        for (const square of row) {
            if (square?.type === 'r' || square?.type === 'n' || square?.type === 'b' || square?.type === 'q') {
                if (square.color === 'w') whitePieces++
                else blackPieces++
            }
        }
    }

    if (whitePieces <= 2 && blackPieces <= 2) return true
    if (whitePieces <= 1 || blackPieces <= 1) return true
}

export function avg(arr: number[]) {
    const sum = arr.reduce((acc, cur) => acc + cur, 0)
    return sum / arr.length
}

function pushAccuracyPhase(arr: accuracyPhases, value: number, phase: 'opening'|'middlegame'|'endgame', color: Color) {
    arr[phase][color].push(value)
}

function pushAccuracy(arr: { w: number[], b: number[] }, value: number, color: Color) {
    arr[color].push(value)
}

export default function PlayersAccuracy(props: { players: players, moves: move[], accuracy: [{ w: number, b: number }, Dispatch<SetStateAction<{ w: number, b: number }>>], setAccuracyPhases: Dispatch<SetStateAction<accuracyPhases>> }) {
    const { players, setAccuracyPhases, moves } = props
    const [accuracy, setAccuracy] = props.accuracy

    useEffect(() => {
        const accuracies: { w: number[], b: number[] } = { w: [], b: [] }
        const accuraciesPhases: accuracyPhases = { opening: { w: [], b: [] }, middlegame: { w: [], b: [] }, endgame: { w: [], b: [] } }

        let currentPhase: 'opening'|'middlegame'|'endgame' = 'opening'
        for (const move of moves) {
            const board = new Chess(move.fen).board()
            const color = move.color === 'w' ? 'b' : 'w'
            const rating = move.moveRating

            let moveAccuracy: number = NaN
            switch (rating) {
                case 'brilliant': case 'great': case 'best': case 'book':
                    moveAccuracy = 100
                    break
                case 'excellent':
                    moveAccuracy = 90
                    break
                case 'good':
                    moveAccuracy = 70
                    break
                case 'inaccuracy': case 'miss':
                    moveAccuracy = 30
                    break
                case 'mistake':
                    moveAccuracy = 20
                    break
                case 'blunder':
                    moveAccuracy = 0
                    break
            }

            if (isNaN(moveAccuracy)) continue

            pushAccuracy(accuracies, moveAccuracy, color)

            switch (currentPhase) {
                case 'opening':
                    pushAccuracyPhase(accuraciesPhases, moveAccuracy, 'opening', color)
                    if (isEndOpening(board)) currentPhase = 'middlegame'
                    break
                case 'middlegame':
                    pushAccuracyPhase(accuraciesPhases, moveAccuracy, 'middlegame', color)
                    if (isEndMiddlegame(board)) currentPhase = 'endgame'
                    break
                case 'endgame':
                    pushAccuracyPhase(accuraciesPhases, moveAccuracy, 'endgame', color)
                    break
            }
        }
        const newAccuracy = { w: avg(accuracies.w), b: avg(accuracies.b) }

        setAccuracy(newAccuracy)
        setAccuracyPhases(accuraciesPhases)
    }, [moves])

    return (
        <div className="w-[85%] flex flex-col items-end gap-3">
            <div className="w-[262px] flex flex-row justify-between font-extrabold">
                <div className="w-20 flex flex-row justify-center whitespace-nowrap overflow-visible"><span>{players[0].name}</span></div>
                <div className="w-20 flex flex-row justify-center whitespace-nowrap overflow-visible"><span>{players[1].name}</span></div>
            </div>
            <div className="flex flex-row w-full justify-between items-center">
                <span className="font-bold text-foregroundGrey text-lg">Players</span>
                <div className="flex flex-row w-[262px] justify-between">
                    <div className="h-20 w-20 flex flex-row justify-center items-end bg-backgroundProfileWhite rounded-borderRoundness">
                        <Profile width={70} height={70} class="fill-foregroundProfileWhite" />
                    </div>
                    <div className="h-20 w-20 flex flex-row justify-center items-end bg-backgroundProfileBlack rounded-borderRoundness">
                        <Profile width={70} height={70} class="fill-foregroundProfileBlack" />
                    </div>
                </div>
            </div>
            <div className="flex flex-row w-full justify-between items-center">
                <span className="font-bold text-foregroundGrey text-lg">Accuracy</span>
                <div className="flex flex-row w-[262px] justify-between">
                    <RatingBox white>{accuracy.w.toFixed(1)}</RatingBox>
                    <RatingBox>{accuracy.b.toFixed(1)}</RatingBox>
                </div>
            </div>
        </div>
    )
}