import { players } from "@/context/analyze";
import { BISHOP, Chess, Color, KNIGHT, Move, PAWN, PieceSymbol, QUEEN, ROOK, Square, WHITE } from "chess.js";
import { SetStateAction } from "react";

export type result = '1-0' | '0-1' | '1/2-1/2' | ''

export type position = ({
    square: Square,
    type: PieceSymbol,
    color: Color,
} | null)[][]

export type square = {
    row: number,
    col: number,
}

export type moveRating = "forced" | "brilliant" | "great" | "best" | "excellent" | "good" | "book" | "inaccuracy" | "mistake" | "miss" | "blunder"

export interface move {
    fen: string,
    movement?: square[],
    staticEval: string[],
    bestMove: square[],
    bestMoveSan: string,
    moveRating?: moveRating,
    comment?: string,
    color: Color,
    capture?: PieceSymbol,
    castle?: 'k' | 'q',
    san?: string,
}

const COMMENTS = {
    brilliant: [
        'You found a brilliant way to sacrifice a piece.',
        'This sacrifice showcases a deep understanding of the position.',
        'A bold and exceptional sacrifice to gain a strategic edge.',
    ],
    great: [
        "You capitalized on your opponent's mistake effectively.",
        "This move takes full advantage of your opponent's error.",
        "A strong response to punish your opponent's oversight.",
    ],
    best: [
        'This has been the best move in this position.',
        'This was the most optimal move you could play here.',
        'The most precise and effective move for this scenario.',
    ],
    excellent: [
        'This was not the absolute best move, but it is just as strong.',
        'An excellent move that fits the demands of the position perfectly. It is not the best though.',
        'A top-tier choice, even if not the single best move.',
    ],
    good: [
        'This is not among the best moves, but it is still acceptable.',
        'An acceptable move, but there were better options.',
        'This move works, but it misses stronger alternatives.',
    ],
    inaccuracy: [
        'This move causes you to lose some advantage.',
        'This move weakens your overall position.',
        'An avoidable slip that leads to a worse situation.',
    ],
    blunder: [
        'This move loses significant advantage.',
        'This move significantly worsens your position.',
        'This move severely harms your position.',
    ],
    mate: [
        'Delivering checkmate is always a satisfying move.',
        'Checkmating your opponent is the ultimate goal.',
        'A decisive and final move to end the game.',
    ],
    mateIn: [
        'This is the right move to force an eventual checkmate.',
        'A precise move that guarantees a checkmate in the near future.',
        'This move sets up an unstoppable sequence to deliver checkmate.',
    ],
    delayMate: [
        'This move delays a checkmate, but your opponent is still being checkmated.',
        "You slowed down the checkmate sequence, but it's still guaranteed.",
        'A move that postpones the unavoidable checkmate you are delivering.',
    ],
    advanceMate: [
        "This decision shortens the path to your opponent's victory.",
        'You hastened the process of being checkmated with this move.',
        'This move brings your opponent closer to delivering checkmate.',
    ],
    loseAdvantage: [
        'This move causes you to lose the advantage you had.',
        'A costly error that sacrifices your winning edge.',
        'This move shifts the position from advantageous to equal or worse.',
    ],
    giveAdvantage: [
        'This move turns an equal position into a losing one.',
        'A mistake that hands the advantage to your opponent.',
        'This move creates a clear advantage for your opponent.',
    ],
    gettingMated: [
        'This move leads to an eventual forced checkmate by your opponent.',
        'A fatal error that guarantees your opponent will checkmate you.',
        'This move sets up an inevitable checkmate against you.',
    ],
    missMate: [
        'You missed an opportunity to force a checkmate, allowing your opponent to escape.',
        'A chance to secure a decisive checkmate was overlooked with this move.',
        'This move lets your opponent avoid a checkmate you could have forced.',
    ],
    missAdvantage: [
        'You missed an opportunity to gain an advantage.',
        'A key chance to improve your position was lost.',
        'This move overlooks a way to strengthen your position.',
    ],
    forced: [
        'There were no alternatives; this was the only possible move.',
        'You had no choice but to play this move.',
        'The situation left you with just one legal option, and this was it.',
    ]
}

async function setHashValue(stockfish: Worker, hash: number) {
    let lastHash = hash

    setTimeout(() => {
        stockfish.removeEventListener("error", reduceHash)
    }, 2000)

    function reduceHash() {
        const hash = lastHash - 50

        stockfish.postMessage(`setoption name Hash value ${hash}`)

        lastHash = hash

        if (lastHash - 50 < 0) {
            stockfish.removeEventListener("error", reduceHash)
        }
    }

    stockfish.addEventListener("error", reduceHash)

    stockfish.postMessage(`setoption name Hash value ${hash}`)
}

export async function prepareStockfish(stockfish: Worker, threads: number, hash: number) {
    await waitTillReady(stockfish)

    stockfish.postMessage("uci")
    stockfish.postMessage(`setoption name Threads value ${threads}`)
    await setHashValue(stockfish, hash)
}

function invertColor(color: Color): Color {
    return color === 'w' ? 'b' : 'w'
}

function getRandomNumber(number: number) {
    return Math.floor(Math.random() * number)
}

function getPlayers(headers: Record<string, string>) {
    const NO_NAME = 'Unknown'
    const NO_ELO = 'NOELO'

    const whiteName = headers.White ?? NO_NAME
    const blackName = headers.Black ?? NO_NAME

    const whiteElo = headers.WhiteElo ?? NO_ELO
    const blackElo = headers.BlackElo ?? NO_ELO

    return [{ name: whiteName, elo: whiteElo }, { name: blackName, elo: blackElo }]
}

function getTime(headers: Record<string, string>) {
    const seconds = headers.TimeControl ?? "0"
    return Number(seconds)
}

function getResult(headers: Record<string, string>): result {
    const result = headers.result ?? ""
    return result as result
}

export function formatSquare(square: string): square {
    const letters = 'abcdefgh'.split('')

    const col = letters.indexOf(square[0])
    const row = Number(square[1]) - 1

    return { col, row }
}

function deformatSquare(square: square) {
    const letters = 'abcdefgh'.split('')

    return `${letters[square.col]}${square.row + 1}`
}

function formatMove(evaluation: string) {
    const line = evaluation.split('\n').filter(line => line.startsWith('bestmove'))[0]
    const move = line?.split(/\s+/)[1]
    if (move === '(none)') return []

    const movement = move ? [move.slice(0, 2), move.slice(2, 4)].map(square => {
        const { col, row } = formatSquare(square)

        return { col, row }
    }) : undefined
    return movement
}

function formatStaticEval(evaluation: string) {
    const line = evaluation.split('\n').filter(line => line.startsWith('info')).pop()
    const fields = line?.split(/\s+/)

    const staticEval = fields?.slice(fields?.indexOf('score') + 1, fields.indexOf('nodes'))

    return staticEval
}

async function getBestMove(program: Worker, depth: number, signal: AbortSignal): Promise<{ bestMove: square[], staticEval: string[] }> {
    program.postMessage(`go depth ${depth}`)

    let staticEval: string[]
    return new Promise((resolve, reject) => {
        function cleanUp() {
            program.removeEventListener('message', readMessage)
            signal?.removeEventListener('abort', handleAbort)
        }

        function readMessage(e: MessageEvent) {
            const line = e.data

            const bestMove = formatMove(line)
            staticEval = formatStaticEval(line) ?? staticEval

            if (bestMove) {
                cleanUp()
                resolve({ bestMove, staticEval })
            }
        }

        function handleAbort() {
            cleanUp()
            reject(new Error('canceled'))
        }

        signal.addEventListener('abort', handleAbort)

        program.addEventListener('message', readMessage)
    })
}

function getMoveRating(staticEval: string[], previousStaticEvals: string[][], bestMove: square[], movement: square[], fen: string, color: Color, sacrifice: boolean, previousSacrice: boolean, openings: {[key: string]: string}): { comment: string, moveRating: moveRating } {
    const reversePreviousStaticEvals = previousStaticEvals.toReversed()

    if (reversePreviousStaticEvals[0] === undefined) reversePreviousStaticEvals[0] = []
    if (reversePreviousStaticEvals[1] === undefined) reversePreviousStaticEvals[1] = []
    if (reversePreviousStaticEvals[2] === undefined) reversePreviousStaticEvals[2] = []
    if (reversePreviousStaticEvals[3] === undefined) reversePreviousStaticEvals[3] = []

    const winning = Number(staticEval[1]) < 0
    const previousWinig = Number(reversePreviousStaticEvals[0][1]) > 0

    const previousColor = invertColor(color)

    function getRandomCommentNumber() {
        return getRandomNumber(3)
    }

    const commentNumber = getRandomCommentNumber()

    function getStandardRating(diff: number) {
        let rating: moveRating = 'excellent'
        if (diff >= 0.4) rating = 'good'
        if (diff >= 0.8) rating = 'inaccuracy'
        if (diff >= 4) rating = 'blunder'

        return rating
    }

    function losingGeatAdvantage(evaluation: number, previousEvaluation: number, color: Color) {
        const GREAT_ADVANTAGE = 2

        if (color === "w") {
            return previousEvaluation >= GREAT_ADVANTAGE && evaluation < GREAT_ADVANTAGE
        } else {
            return previousEvaluation <= -GREAT_ADVANTAGE && evaluation > -GREAT_ADVANTAGE
        }
    }

    function givingGeatAdvantage(evaluation: number, previousEvaluation: number, color: Color) {
        const GREAT_ADVANTAGE = -2

        if (color === "w") {
            return previousEvaluation >= GREAT_ADVANTAGE && evaluation < GREAT_ADVANTAGE
        } else {
            return previousEvaluation <= -GREAT_ADVANTAGE && evaluation > -GREAT_ADVANTAGE
        }
    }

    function keepMating(mateIn: number, previousMateIn: number, color: Color) {
        if (color === "w") {
            return mateIn < previousMateIn
        } else {
            return mateIn > previousMateIn
        }
    }

    function advanceMate(mateIn: number, previousMateIn: number, color: Color) {
        if (color === "w") {
            return mateIn > previousMateIn
        } else {
            return mateIn < previousMateIn
        }
    }

    function getPreviousStaticEvalAmount(number: number) {
        const checkColor = number % 2 === 0 ? 'b' : 'w'
        return Number(reversePreviousStaticEvals[number][1]) / 100 * (color === checkColor ? -1 : 1)
    }

    const staticEvalAmount = Number(staticEval[1]) / 100 * (color === 'w' ? -1 : 1)

    function getWasNotMateRelated(number: number) {
        return reversePreviousStaticEvals[number][0] !== 'mate' && reversePreviousStaticEvals[number + 1][0] !== 'mate'
    }

    const isNotMateRelated = staticEval[0] !== 'mate' && reversePreviousStaticEvals[0][0] !== 'mate'

    // book
    const openingName = openings[fen]
    if (openingName) return { moveRating: 'book', comment: openingName }

    // standard
    function getPreviousStandardRating(number: number) {
        return getStandardRating(getPreviousEvaluationDiff(number))
    }

    function getPreviousEvaluationDiff(number: number) {
        const checkColor = number % 2 === 0 ? 'b' : 'w'
        return color === checkColor ? getPreviousStaticEvalAmount(number + 1) - getPreviousStaticEvalAmount(number) : getPreviousStaticEvalAmount(number) - getPreviousStaticEvalAmount(number + 1)
    }

    const evaluationDiff = color === "w" ? getPreviousStaticEvalAmount(0) - staticEvalAmount : staticEvalAmount - getPreviousStaticEvalAmount(0)
    const standardRating = getStandardRating(evaluationDiff)

    const previousMistake = getWasNotMateRelated(0) && getWasNotMateRelated(1) && getPreviousStandardRating(0) === "inaccuracy" && getPreviousEvaluationDiff(0) >= 1.2 && (losingGeatAdvantage(getPreviousStaticEvalAmount(0), getPreviousStaticEvalAmount(1), previousColor) || givingGeatAdvantage(getPreviousStaticEvalAmount(0), getPreviousStaticEvalAmount(1), previousColor))
    const previousPreviousMistake = getWasNotMateRelated(1) && getWasNotMateRelated(2) && getPreviousStandardRating(1) === "inaccuracy" && getPreviousEvaluationDiff(1) >= 1.2 && (losingGeatAdvantage(getPreviousStaticEvalAmount(1), getPreviousStaticEvalAmount(2), color) || givingGeatAdvantage(getPreviousStaticEvalAmount(1), getPreviousStaticEvalAmount(2), color))

    const previousMiss =
    (
        getWasNotMateRelated(0)
        &&
        (previousPreviousMistake || getPreviousStandardRating(1) === "blunder")
        &&
        (getPreviousStandardRating(0) === "blunder" || getPreviousStandardRating(0) === "inaccuracy")
        &&
        (getPreviousEvaluationDiff(0) <= getPreviousEvaluationDiff(1) + 0.5)
    )

    // brilliant - sacrifice
    const previousBrilliant = getWasNotMateRelated(0) && previousSacrice && getPreviousStandardRating(0) === 'excellent'
    if (
        !previousBrilliant
        &&
        isNotMateRelated
        &&
        standardRating === 'excellent'
        &&
        sacrifice
        &&
        (
            getPreviousStandardRating(0) === 'inaccuracy' || getPreviousStandardRating(0) === 'blunder'
            ||
            (
                !(getPreviousStandardRating(1) === 'inaccuracy' || getPreviousStandardRating(1) === 'blunder')
                &&
                (getPreviousStandardRating(2) === 'inaccuracy' || getPreviousStandardRating(2) === 'blunder')
            )
        )
    ) return { moveRating: 'brilliant', comment: COMMENTS.brilliant[commentNumber] }

    // brilliant - start mate
    if (sacrifice && reversePreviousStaticEvals[0][0] !== 'mate' && staticEval[0] === 'mate' && winning) return { moveRating: 'brilliant', comment: COMMENTS.brilliant[commentNumber] }

    // brilliant - right move to mate
    if (sacrifice && reversePreviousStaticEvals[0][0] === 'mate' && staticEval[0] === 'mate' && keepMating(staticEvalAmount, getPreviousStaticEvalAmount(0), color) && winning) return { moveRating: 'brilliant', comment: COMMENTS.brilliant[commentNumber] }

    // great - gaining advantage
    if (
        !previousMiss
        &&
        getWasNotMateRelated(0)
        &&
        isNotMateRelated
        &&
        standardRating === 'excellent'
        &&
        (previousMistake || getPreviousStandardRating(0) === 'blunder')
    ) return { moveRating: 'great', comment: COMMENTS.great[commentNumber] }

    // best
    const isBest = movement.every((move, i) => {
        return JSON.stringify(move) === JSON.stringify(bestMove[i])
    })
    if (isBest && staticEval[0] === 'mate' && !staticEval[1]) return { moveRating: 'best', comment: COMMENTS.mate[commentNumber] }

    if (isBest) return { moveRating: 'best', comment: COMMENTS.best[commentNumber] }

    // excellent - mate
    if (staticEval[0] === 'mate' && !staticEval[1]) return { moveRating: 'excellent', comment: COMMENTS.mate[commentNumber] }

    // excellent - start mate
    if (reversePreviousStaticEvals[0][0] !== 'mate' && staticEval[0] === 'mate' && winning) return { moveRating: 'excellent', comment: COMMENTS.mateIn[commentNumber] }

    // excellent - right move to mate
    if (reversePreviousStaticEvals[0][0] === 'mate' && staticEval[0] === 'mate' && keepMating(staticEvalAmount, getPreviousStaticEvalAmount(0), color) && winning) return { moveRating: 'excellent', comment: COMMENTS.mateIn[commentNumber] }

    // good - delay mate
    if (reversePreviousStaticEvals[0][0] === 'mate' && staticEval[0] === 'mate' && !keepMating(staticEvalAmount, getPreviousStaticEvalAmount(0), color) && winning) return { moveRating: 'good', comment: COMMENTS.delayMate[commentNumber] }

    // good - advance mate
    if (reversePreviousStaticEvals[0][0] === 'mate' && staticEval[0] === 'mate' && advanceMate(staticEvalAmount, getPreviousStaticEvalAmount(0), color) && !winning) return { moveRating: 'good', comment: COMMENTS.advanceMate[commentNumber] }

    // miss - mate
    if (reversePreviousStaticEvals[0][0] === 'mate' && staticEval[0] !== 'mate' && previousWinig) return { moveRating: 'miss', comment: COMMENTS.missMate[commentNumber] }

    // miss - gain advantage
    if (
        !previousMiss
        &&
        isNotMateRelated
        &&
        (previousMistake || getPreviousStandardRating(0) === 'blunder')
        &&
        (standardRating === "blunder" || standardRating === "inaccuracy")
        &&
        (evaluationDiff <= getPreviousEvaluationDiff(0) + 0.5)
    ) return { moveRating: 'miss', comment: COMMENTS.missAdvantage[commentNumber] }

    // mistake - lose advantage
    if (isNotMateRelated && standardRating === "inaccuracy" && evaluationDiff >= 1.2 && losingGeatAdvantage(staticEvalAmount, getPreviousStaticEvalAmount(0), color)) return { moveRating: 'mistake', comment: COMMENTS.loseAdvantage[commentNumber] }

    // mistake - give advantage
    if (isNotMateRelated && standardRating === "inaccuracy" && evaluationDiff >= 1.2 && givingGeatAdvantage(staticEvalAmount, getPreviousStaticEvalAmount(0), color)) return { moveRating: 'mistake', comment: COMMENTS.giveAdvantage[commentNumber] }

    // mistake - mate
    if (reversePreviousStaticEvals[0][0] !== 'mate' && staticEval[0] === 'mate' && !winning && (color === WHITE ? getPreviousStaticEvalAmount(0) <= -2 : getPreviousStaticEvalAmount(0) >= 2)) return { moveRating: 'mistake', comment: COMMENTS.gettingMated[commentNumber] }

    // blunder - mate
    if (
        (reversePreviousStaticEvals[0][0] !== 'mate' && staticEval[0] === 'mate' && !winning)
        ||
        (reversePreviousStaticEvals[0][0] === 'mate' && staticEval[0] === 'mate' && !winning && previousWinig)
    ) return { moveRating: 'blunder', comment: COMMENTS.gettingMated[commentNumber] }

    return { moveRating: standardRating, comment: COMMENTS[standardRating][commentNumber] }
}

async function analyze(program: Worker, fen: string, depth: number, signal: AbortSignal) {
    program.postMessage(`position fen ${fen}`)

    try {
        const { bestMove, staticEval } = await getBestMove(program, depth, signal)
        return { bestMove, staticEval }
    } catch {
        throw new Error('cancelled')
    }
}

function getAttackersDefenders(chess: Chess, color: Color, to: Square) {
    const attackers = chess.attackers(to, invertColor(color))
    const legalAttackers = attackers.filter(attacker => chess.moves({ verbose: true }).findIndex(move => move.from === attacker && move.to === to) !== -1)
    const legalAttackersPieces = legalAttackers.map(attacker => chess.get(attacker))

    let defenders, legalDefenders, legalDefendersPieces
    if (attackers.length === 1) {
        const testChess = new Chess(chess.fen())
        try {
            testChess.move({ from: attackers[0], to })
        } catch { }

        defenders = testChess.attackers(to, color)
        legalDefenders = defenders.filter(defender => {
            if (testChess.moves({ verbose: true }).findIndex(move => move.from === defender && move.to === to) === -1) {
                return false
            }
            return true
        })
        legalDefendersPieces = legalDefenders.map(defender => chess.get(defender))
    } else {
        defenders = chess.attackers(to, color)
        legalDefenders = defenders.filter(defender => {
            for (const attacker of legalAttackers) {
                const testChess = new Chess(chess.fen())
                try {
                    testChess.move({ from: attacker, to: to })
                } catch { }
    
                if (testChess.moves({ verbose: true }).findIndex(move => move.from === defender && move.to === to) === -1) {
                    return false
                }
            }
            return true
        })
        legalDefendersPieces = legalDefenders.map(defender => chess.get(defender))
    }

    return { attackers: { squares: legalAttackers, pieces: legalAttackersPieces, length: legalAttackers.length }, defenders: { squares: legalDefenders, pieces: legalDefendersPieces, length: legalDefenders.length } }
}

function couldBeSaved(chess: Chess, square: Square, color: Color) {
    if (!chess.attackers(square, color).length) {
        for (const move of chess.moves({ verbose: true })) {
            if (move.from !== square) return true
        }
    } else {
        for (const move of chess.moves({ verbose: true, square: square })) {
            const testChess = new Chess(move.after)
            if (!testChess.attackers(move.to, color).length) return true
        }
    }

    return false
}

function isSacrifice(move: Move) {
    const chess = new Chess(move.after)
    const chessBefore = new Chess(move.before)

    const sacrifying: {
        square: Square,
        type: PieceSymbol,
        color: Color,
    }[] = []

    const board = chess.board()
    for (const row of board) {
        for (const square of row) {
            if (!square || square.type === PAWN) continue
            if (square.color !== move.color) continue

            const { attackers, defenders } = getAttackersDefenders(chess, move.color, square.square)

            if (!defenders.length && attackers.length && (!move.captured || move.captured === PAWN)) {
                sacrifying.push(square)
                continue
            }
            if ((square.type === KNIGHT || square.type === BISHOP) && !move.captured && attackers.pieces.findIndex(piece => piece?.type === PAWN) !== -1) {
                sacrifying.push(square)
                continue
            }
            if (square.type === ROOK && attackers.length && (move.captured !== ROOK && move.captured !== QUEEN) && !(attackers.length === 1 && (attackers.pieces[0]?.type === QUEEN || attackers.pieces[0]?.type === ROOK) && defenders.length) && !(defenders.length && (move.captured === KNIGHT || move.captured === BISHOP))) {
                sacrifying.push(square)
                continue
            }
            if (square.type === QUEEN && attackers.length && move.captured !== QUEEN && !(attackers.length === 1 && attackers.pieces[0]?.type === QUEEN && defenders.length) && !(attackers.length === 1 && attackers.pieces[0]?.type === ROOK && move.captured === ROOK && defenders.length)) {
                sacrifying.push(square)
                continue
            }
        }
    }

    for (const square of sacrifying) {
        const beforeSquare = chessBefore.get(square.square)?.color === chess.get(square.square)?.color && chessBefore.get(square.square)?.type === chess.get(square.square)?.type ? square.square : move.from

        if (couldBeSaved(chessBefore, beforeSquare, invertColor(move.color))) return true
    }

    return false
}

function isForced(move: Move) {
    const chess = new Chess(move.before)

    return chess.moves().length === 1
}

function cleanStockfish(stockfish: Worker) {
    stockfish.postMessage("stop")
    stockfish.postMessage("ucinewgame")
}

async function waitTillReady(engine: Worker, signal?: AbortSignal) {
    return new Promise((resolve, reject) => {
        function cleanUp() {
            engine.removeEventListener('message', isReadyOk)
            signal?.removeEventListener('abort', handleAbort)
        }

        function isReadyOk(e: MessageEvent) {
            if (e.data === 'readyok') {
                cleanUp()
                resolve(true)
            }
        }

        function handleAbort() {
            cleanUp()
            reject(new Error('canceled'))
        }

        signal?.addEventListener('abort', handleAbort)

        engine.addEventListener('message', isReadyOk)
        engine.postMessage('isready')
    })
}

function clearPgn(pgn: string) {
    // remove comments
    return pgn.replace(/^%.*/gm, '')
}

function moveToSan(move: square[], fen: string) {
    if (!move.length) return ""

    try {
        const chess = new Chess(fen)
        const moveObject = chess.move({from: deformatSquare(move[0]), to: deformatSquare(move[1])})
        return moveObject.san
    } catch {
        return ""
    }
}

export async function parseMove(stockfish: Worker, depth: number, move: Move, chess: Chess, previousStaticEvals: string[][], previousBestMove: square[] | undefined, previousSacrifice: boolean, openings: any, handleAbort: () => void, signal: AbortSignal): Promise< move & { sacrifice: boolean }> {
    if (signal.aborted) handleAbort()
    const movement: square[] = [move.from, move.to].map(square => {
        const { col, row } = formatSquare(square)

        return { col, row }
    })

    const fen = move.after
    chess.load(fen)

    const color = invertColor(move.color)
    const capture = move.captured
    const san = move.san

    const castle: 'k' | 'q' | undefined = move.san === 'O-O' ? 'k' : move.san === 'O-O-O' ? 'q' : undefined

    let sacrifice, staticEval: string[], bestMove: square[], forced
    if (chess.isCheckmate()) {
        sacrifice = false
        staticEval = ["mate"]
        bestMove = []
        forced = false
    } else {
        sacrifice = move.promotion ? false : isSacrifice(move)

        try {
            ({ staticEval, bestMove } = await analyze(stockfish, move.after, depth, signal))
        } catch {
            handleAbort()
            bestMove = []
            staticEval = []
        }

        if (signal.aborted) handleAbort()
        forced = isForced(move)
    }

    const { moveRating, comment } = forced ? { moveRating: 'forced', comment: COMMENTS.forced[getRandomNumber(3)] } as { moveRating: moveRating, comment: string } : getMoveRating(staticEval, previousStaticEvals, previousBestMove ?? [], movement, move.after, move.color, sacrifice, previousSacrifice, openings)

    if (chess.isGameOver()) bestMove = []

    const bestMoveSan = moveToSan(bestMove, fen)

    return {
        color,
        capture,
        san,
        castle,
        moveRating,
        comment,
        bestMove,
        bestMoveSan,
        fen,
        staticEval,
        sacrifice,
        movement
    }
}

export function parsePGN(stockfish: Worker, rawPgn: string, depth: number, setProgress: React.Dispatch<SetStateAction<number>>, signal: AbortSignal): Promise<{ metadata: { time: number, players: players, result: result }, moves: move[] }> {
    return new Promise(async (resolve, reject) => {
        function handleAbort() {
            reject(new Error('canceled'))
            signal.removeEventListener('abort', handleAbort)
            setProgress(0)
        }

        signal.addEventListener('abort', handleAbort)

        const chess = new Chess()

        const pgn = clearPgn(rawPgn)

        try {
            chess.loadPgn(pgn)
        } catch {
            reject(new Error('pgn'))
        }

        const openingsRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/openings/openings.json`)
        const openings = await openingsRes.json()

        const headers = chess.header()

        const players = getPlayers(headers)
        const time = getTime(headers)
        const result = getResult(headers)

        const history = chess.history({ verbose: true })

        const totalMoves = history.length
        let progress = 0

        const metadata = { players, time, result }

        const moves: move[] = []

        cleanStockfish(stockfish)
        try {
            await waitTillReady(stockfish, signal)
        } catch {
            handleAbort()
        }

        if (signal.aborted) handleAbort()

        let moveNumber = 0, previousBestMove, previousSacrifice = false
        const previousStaticEvals: string[][] = []
        for (const move of history) {
            if (moveNumber === 0) {
                const fen = move.before
                chess.load(fen)
                const color = move.color
        
                let analyzeObject
                try {
                    analyzeObject = await analyze(stockfish, move.before, depth, signal)
                } catch {
                    handleAbort()
                    analyzeObject = { bestMove: [], staticEval: [] }
                }
        
                if (signal.aborted) handleAbort()
        
                const { bestMove, staticEval } = analyzeObject
        
                const bestMoveSan = moveToSan(bestMove, fen)
        
                moves.push({
                    fen,
                    staticEval,
                    bestMove,
                    bestMoveSan,
                    color,
                })
                previousBestMove = bestMove
                previousStaticEvals.push(staticEval)
            }

            const {
                fen,
                movement,
                staticEval,
                bestMove,
                moveRating,
                comment,
                color,
                capture,
                castle,
                san,
                bestMoveSan,
                sacrifice,
            } = await parseMove(stockfish, depth, move, chess, previousStaticEvals, previousBestMove, previousSacrifice, openings, handleAbort, signal)

            moves.push({
                fen,
                movement,
                staticEval,
                bestMove,
                moveRating,
                comment,
                color,
                capture,
                castle,
                san,
                bestMoveSan
            })

            previousBestMove = bestMove
            previousStaticEvals.push(staticEval)
            moveNumber++
            previousSacrifice = sacrifice
    
            progress++
            setProgress((progress / totalMoves) * 100)
        }

        resolve({ metadata, moves })
    })
}