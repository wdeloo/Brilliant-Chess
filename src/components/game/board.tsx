import { moveRating, position, result, square } from "@/engine/stockfish";
import Image from "next/image";
import { RefObject, useContext, useEffect, useRef, useState } from "react";
import { Chess, Color, KING, PieceSymbol, Square, WHITE } from "chess.js";
import { Howl } from "howler";
import { AnalyzeContext } from "@/context/analyze";
import { ConfigContext } from "@/context/config";
import { boardThemes } from "../nav/settings/themes";
import { maxVertical } from "../../../tailwind.config";
import { arrow, Controller } from "./game";

interface filteredHighlightStyle {
    [key: string]: { color: string, icon: string }
}

const DEFAULT_POSITION = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

const PIECES_IMAGES = {
    w: {
        p: 'white/pawn.svg',
        r: 'white/rook.svg',
        n: 'white/knight.svg',
        b: 'white/bishop.svg',
        q: 'white/queen.svg',
        k: 'white/king.svg'
    },
    b: {
        p: 'black/pawn.svg',
        r: 'black/rook.svg',
        n: 'black/knight.svg',
        b: 'black/bishop.svg',
        q: 'black/queen.svg',
        k: 'black/king.svg',
    }
}

const HIGHLIGHT_STYLE = {
    forced: { color: "", icon: "forced.svg" },
    brilliant: { color: "var(--highlightBrilliant)", icon: "brilliant.svg" },
    great: { color: "var(--highlightGreat)", icon: "great.svg" },
    best: { color: "var(--highlightBest)", icon: "best.svg" },
    excellent: { color: "var(--highlightExcellent)", icon: "excellent.svg" },
    good: { color: "var(--highlightGood)", icon: "good.svg" },
    book: { color: "var(--highlightBook)", icon: "book.svg" },
    inaccuracy: { color: "var(--highlightInaccuracy)", icon: "inaccuracy.svg" },
    mistake: { color: "var(--highlightMistake)", icon: "mistake.svg" },
    miss: { color: "var(--highlightMiss)", icon: "miss.svg" },
    blunder: { color: "var(--highlightBlunder)", icon: "blunder.svg" },
}

const PIECES_VALUES = {
    p: 1,
    n: 3,
    b: 3,
    r: 5,
    q: 9,
    k: 0,
}

const moveSelfSound = new Howl({
    src: ['/sounds/move-self.mp3'],
    preload: true,
})

const moveOpponentSound = new Howl({
    src: ['/sounds/move-opponent.mp3'],
    preload: true,
})

const moveCheckSound = new Howl({
    src: ['/sounds/move-check.mp3'],
    preload: true,
})

const gameEndSound = new Howl({
    src: ['/sounds/game-end.mp3'],
    preload: true,
})

export const gameStartSound = new Howl({
    src: ['/sounds/game-start.mp3'],
    preload: true,
})

const captureSound = new Howl({
    src: ['/sounds/capture.mp3'],
    preload: true,
})

const castleSound = new Howl({
    src: ['/sounds/castle.mp3'],
    preload: true,
})

function isEven(num: number) {
    return (num % 2) === 0
}

function getSquareId(column: number, row: number) {
    const columnId = String.fromCharCode(97 + column)
    const rowId = 8 - row
    return columnId + rowId
}

function adaptSquare(square: square): square {
    return { col: square.col, row: 7 - square.row }
}

function getCastleRookFromSquare(castle: 'k' | 'q' | undefined, whiteMoving: boolean, position: position): square | undefined {
    if (!castle) return
    return { col: castle === 'k' ? 7 : 0, row: whiteMoving ? 7 : 0 }
}

function getCastleRookToSquare(castle: 'k' | 'q' | undefined, whiteMoving: boolean): square | undefined {
    if (!castle) return
    return { col: castle === 'k' ? 5 : 3, row: whiteMoving ? 7 : 0 }
}

function flipBoard(board: position) {
    for (const row of board) {
        row.reverse()
    }
    board.reverse()
}

function PreloadRatingImages({ highlightedStyle }: { highlightedStyle: filteredHighlightStyle }) {
    const preloaders = []
    for (const rating in highlightedStyle) {
        const url = '/images/rating/' + highlightedStyle[rating as keyof typeof highlightedStyle].icon

        preloaders.push(
            <Image key={rating} alt={"preload " + rating} src={url} priority hidden width={1} height={0} />
        )
    }

    return preloaders
}

function isKnightMove(from: square, to: square) {
    return (Math.abs(from.col - to.col) === 2 && Math.abs(from.row - to.row) === 1) || (Math.abs(from.col - to.col) === 1 && Math.abs(from.row - to.row) === 2)
}

export function Arrow(props: { move: square[], squareSize: number, class: string, white: boolean }) {

    const { move, squareSize, white } = props

    if (!move[1]) {
        const elementPosition = {
            x: (squareSize * move[0].col) + 'px',
            y: (squareSize * move[0].row) + 'px',
        }

        let rounded: string = ''
        if (move[0].row === 0 && move[0].col === 0) rounded = white ? 'rounded-tl-borderRoundness' : 'rounded-br-borderRoundness'
        if (move[0].row === 7 && move[0].col === 0) rounded = white ? 'rounded-bl-borderRoundness' : 'rounded-tr-borderRoundness'
        if (move[0].row === 0 && move[0].col === 7) rounded = white ? 'rounded-tr-borderRoundness' : 'rounded-bl-borderRoundness'
        if (move[0].row === 7 && move[0].col === 7) rounded = white ? 'rounded-br-borderRoundness' : 'rounded-tl-borderRoundness'

        const size = squareSize + 'px'

        return <div style={{ top: white ? elementPosition.y : '', bottom: !white ? elementPosition.y : '', left: white ? elementPosition.x : '', right: !white ? elementPosition.x : '', width: size, height: size }} className={`absolute opacity-80 z-[10] ${props.class} ${rounded}`} />
    }

    const [from, to] = move

    if (isKnightMove(from, to)) {
        const getTransform = () => {
            const longY = Math.abs(from.row - to.row) > Math.abs(from.col - to.col)
            const toDown = white ? (from.row < to.row) : (from.row > to.row)
            const toLeft = white ? (from.col < to.col) : (from.col > to.col)

            let rotation = 0
            let scaleX = 1
            let scaleY = 1

            if (longY) {
                if (toDown) {
                    rotation = 270
                    if (toLeft) scaleY = -1
                } else {
                    rotation = 90
                    if (!toLeft) scaleY = -1
                }
            } else {
                if (toDown) {
                    rotation = 180
                    if (!toLeft) scaleX = -1
                } else {
                    if (toLeft) scaleX = -1
                }
            }

            return `rotate(${rotation}deg) scaleX(${scaleX}) scaleY(${scaleY})`
        }

        const fromElementPosition = {
            x: squareSize * (white ? from.col : (7 - from.col)),
            y: squareSize * (white ? from.row : (7 - from.row)),
        }
    
        const toElementPosition = {
            x: squareSize * (white ? to.col : (7 - to.col)),
            y: squareSize * (white ? to.row : (7 - to.row)),
        }

        const distance = {
            x: Math.abs(fromElementPosition.x - toElementPosition.x),
            y: Math.abs(fromElementPosition.y - toElementPosition.y),
        }

        const longLineLength = Math.abs(Math.max(distance.x, distance.y))
        const shortLineLength = Math.abs(Math.min(distance.x, distance.y))

        const lineWidth = (squareSize / 2) * (3 / 7)

        const arrowHeadHeight = lineWidth * 1.6
        const arrowHeadWidth = squareSize / 2

        const height = shortLineLength + lineWidth / 2
        const width = longLineLength + (squareSize / 4) - arrowHeadHeight

        const longLineCenter = height - (lineWidth / 2)
        const shortLineCenter = arrowHeadWidth / 2

        const positionX = `${toElementPosition.x + (squareSize / 2) - (arrowHeadWidth / 2)}px`
        const positionY = `${toElementPosition.y + (squareSize / 2)}px`

        return (
            <svg style={{ top: positionY, left: positionX, transformOrigin: `${arrowHeadWidth / 2}px 0`, transform: getTransform() }} className={`absolute opacity-65 z-[70] pointer-events-none ${props.class}`} width={width} height={height} xmlns="http://www.w3.org/2000/svg">
                <polygon strokeWidth={0} points={`0,${arrowHeadHeight} ${shortLineCenter},0 ${arrowHeadWidth},${arrowHeadHeight}`} />
                <path fill="none" strokeWidth={lineWidth} d={`M ${shortLineCenter} ${arrowHeadHeight - 1} L ${shortLineCenter} ${longLineCenter} L ${width} ${longLineCenter}`} />
            </svg>
        )
    }

    const fromElementPosition = {
        x: squareSize * from.col,
        y: squareSize * from.row,
    }

    const toElementPosition = {
        x: squareSize * to.col,
        y: squareSize * to.row,
    }

    const distance = {
        x: (fromElementPosition.x - toElementPosition.x) * (white ? 1 : -1),
        y: (fromElementPosition.y - toElementPosition.y) * (white ? 1 : -1),
    }

    const realDistance = Math.sqrt((distance.x ** 2) + (distance.y ** 2))

    const angle = Math.atan2(distance.x, distance.y)
    const degs = angle * (180 / Math.PI)

    const width = squareSize / 2
    const lineCenter = width / 2
    const lineWidth = width * (3 / 7)
    const arrowHeadHeight = lineWidth * 1.6
    const height = realDistance - arrowHeadHeight

    const positionX = `${toElementPosition.x + (squareSize / 2) - (width / 2)}px`
    const positionY = `${toElementPosition.y + (squareSize / 2) - (white ? 0 : height)}px`

    return (
        <svg style={{ top: white ? positionY : '', bottom: !white ? positionY : '', left: white ? positionX : '', right: !white ? positionX : '', transformOrigin: '50% 0', rotate: (-degs) + 'deg' }} className={`absolute opacity-65 z-[70] pointer-events-none ${props.class}`} width={width} height={height} xmlns="http://www.w3.org/2000/svg">
            <line x1={lineCenter} y1={height} x2={lineCenter} y2={arrowHeadHeight - 1} strokeWidth={lineWidth} markerEnd="url(#arrowhead)" />
            <polygon strokeWidth={0} points={`0,${arrowHeadHeight} ${lineCenter},0 ${width},${arrowHeadHeight}`} />
        </svg>
    )
}

function Piece(props: { pieceRef: RefObject<HTMLDivElement>, castleRookRef: RefObject<HTMLDivElement>, moved: boolean, isCastleRook: boolean, pieceType: PieceSymbol, pieceColor: Color, pieceImages: string, drag: {is: boolean, id: string}, setDrag: (dragging: {is: boolean, id: string}) => void, id: string, handleMouseDown: (e: React.MouseEvent) => void, handleMouseUp: (e: React.MouseEvent) => void }) {
    const { pieceRef, castleRookRef, moved, isCastleRook, pieceType, pieceColor, pieceImages, drag, setDrag, id, handleMouseDown, handleMouseUp } = props

    const [movement, setMovement] = useState({ x: 0, y: 0 })

    function handlePieceDragStart(e: React.MouseEvent) {
        if (e.button !== 0) return

        const element = e.currentTarget
        const elemenRect = element.getBoundingClientRect()

        const startPosition = { x: elemenRect.x + elemenRect.width / 2, y: elemenRect.y + elemenRect.height / 2 }

        function pieceDrag(e: MouseEvent) {
            handlePieceDrag(e, startPosition)
        }

        function pieceDragStop(e: MouseEvent) {
            handlePieceDragStop(e, startPosition)

            document.removeEventListener('mousemove', pieceDrag)
            document.removeEventListener('mouseup', pieceDragStop)
            document.body.style.cursor = ''
        }

        document.addEventListener('mousemove', pieceDrag)
        document.addEventListener('mouseup', pieceDragStop)

        document.body.style.cursor = 'grabbing'

        const movement = {
            x: e.clientX - startPosition.x,
            y: e.clientY - startPosition.y,
        }

        setMovement(movement)

        setDrag({ is: true, id })
    }

    function handlePieceDrag(e: MouseEvent, startPosition: { x: number, y: number }) {
        if (e.button !== 0) return

        const movement = {
            x: e.clientX - startPosition.x,
            y: e.clientY - startPosition.y,
        }

        setMovement(movement)
    }

    function handlePieceDragStop(e: MouseEvent, startPosition: { x: number, y: number }) {
        if (e.button !== 0) return

        setMovement({ x: 0, y: 0 })
        setDrag({ is: false, id })
    }

    return (
        <div
            data-dontcleandrag={true}
            onMouseDown={handlePieceDragStart}
            ref={moved ? pieceRef : (isCastleRook ? castleRookRef : null)}
            className="w-full relative h-full z-[20] cursor-grab"
            style={{ top: movement.y || '', left: movement.x || '', zIndex: drag.is && drag.id === id ? 90 : '' }}
        >
            <Image
                data-dontcleandrag={true}
                draggable={false}
                alt={`${pieceType}-${pieceColor}`}
                className="w-full"
                width={200} height={0}
                src={`/images/pieces/${pieceImages}`}
                priority
            />
        </div>
    )
}

export default function Board(props: { cleanArrows: () => void, controller: Controller, boardSize: number, fen?: string, nextFen?: string, move?: square[], nextMove?: square[], bestMove?: square[], previousBestMove?: square[], moveRating?: moveRating, forward: boolean, white: boolean, animation: boolean, gameEnded: boolean, capture?: PieceSymbol, nextCapture?: PieceSymbol, castle?: 'k' | 'q', nextCastle?: 'k' | 'q', setAnimation: (animation: boolean) => void, result: result, arrows: arrow[], pushArrow: (arrow: arrow) => void }) {
    const [drag, setDrag] = useState<{is: boolean, id: string}>({is: false, id: ''})
    const [hoverDrag, setHoverDrag] = useState('')

    const configContext = useContext(ConfigContext)
    const analyzeContext = useContext(AnalyzeContext)

    const [boardTheme, setBoardTheme] = configContext.boardTheme
    const [usedRatings, setUsedRatings] = configContext.usedRatings
    const [highlightByRating, setHighlightByRating] = configContext.highlightByRating
    const [showArrows, setShowArrows] = configContext.showArrows
    const [arrowAfterMove, setArrowAfterMove] = configContext.arrowAfterMove

    const [materialAdvantage, setMaterialAdvantage] = analyzeContext.materialAdvantage

    const pieceRef = useRef<HTMLDivElement>(null)
    const castleRookRef = useRef<HTMLDivElement>(null)

    const currentArrowRef = useRef<square[]>([])

    const { pushArrow, cleanArrows, arrows, controller, boardSize, bestMove, previousBestMove, moveRating, forward, white, animation, gameEnded, capture, nextCapture, castle, nextCastle, setAnimation, result } = props
    const fen = props.fen ?? DEFAULT_POSITION
    const nextFen = props.nextFen ?? DEFAULT_POSITION
    const move = props.move ?? []
    const nextMove = props.nextMove ?? []

    const squareSize = Math.round(boardSize / 8)
    const guideSize = squareSize / 4
    const leftSize = guideSize / 4.5
    const rightSize = guideSize / 2.5

    const chess = new Chess(fen)
    const board = chess.board()
    if (!white) flipBoard(board)

    const whiteMoving = !(chess.turn() === 'w')

    const castleRookFrom = getCastleRookFromSquare(forward ? castle : nextCastle, forward ? whiteMoving : !whiteMoving, board)
    const castleRookTo = getCastleRookToSquare(forward ? castle : nextCastle, forward ? whiteMoving : !whiteMoving)

    const castleRookMove: square[] = castleRookFrom && castleRookTo ? [castleRookFrom, castleRookTo] : []

    const filteredHighlightStyle = filterHighlightStyle(HIGHLIGHT_STYLE)

    const highlightColor = highlightByRating ? filteredHighlightStyle[moveRating as keyof typeof filteredHighlightStyle]?.color ?? boardThemes[boardTheme].highlight : boardThemes[boardTheme].highlight
    const highlightIcon = filteredHighlightStyle[moveRating as keyof typeof filteredHighlightStyle]?.icon

    const soundChessInstance = forward ? chess : new Chess(nextFen)
    const soundCaptureInstance = forward ? capture : nextCapture
    const soundCastleInstance = forward ? castle : nextCastle

    const selfTurn = !(soundChessInstance.turn() === 'w' ? white : !white)

    const isLastMove = !nextMove.length && move.length

    useEffect(() => {
        if (drag.is) return
        if (!drag.id) return

        const selectedPiece = chess.get(drag.id as Square)
        if (!selectedPiece) {
            setDrag({ is: false, id: "" })
            return
        }

        if (selectedPiece.color !== chess.turn()) {
            setDrag({ is: false, id: "" })
            return
        }
    }, [fen])

    useEffect(() => {
        if (!props.fen) return

        if (soundChessInstance.isCheck()) {
            moveCheckSound.play()
        } else if (soundCastleInstance) {
            castleSound.play()
        } else if (soundCaptureInstance) {
            captureSound.play()
        } else {
            if (selfTurn) {
                moveSelfSound.play()
            } else {
                moveOpponentSound.play()
            }
        }

        if (gameEnded) {
            gameEndSound.play()
        }
    }, [fen])

    useEffect(() => {
        if (!animation) return
        if (pieceRef.current) animateMove(pieceRef.current, forward ? move : nextMove, 60, forward, white, squareSize)
        if (castleRookRef.current) animateMove(castleRookRef.current, castleRookMove, 50, forward, white, squareSize)
    }, [move, animation])

    let newMaterialAdvantage = 0
    useEffect(() => setMaterialAdvantage(newMaterialAdvantage), [fen])

    function startArrow(x: number, y: number) {
        const rowNumber = Math.floor(y / squareSize)
        const colNumber = Math.floor(x / squareSize)

        const square = { col: white ? colNumber : 7 - colNumber, row: white ? rowNumber : 7 - rowNumber }
        currentArrowRef.current[0] = square
    }
    function endArrow(x: number, y: number) {
        const rowNumber = Math.floor(y / squareSize)
        const colNumber = Math.floor(x / squareSize)

        const square = { col: white ? colNumber : 7 - colNumber, row: white ? rowNumber : 7 - rowNumber }
        currentArrowRef.current[1] = square

        if (!currentArrowRef.current[0] || !currentArrowRef.current[1]) return

        pushArrow([...currentArrowRef.current])
    }

    function filterHighlightStyle(highlightStyle: typeof HIGHLIGHT_STYLE) {
        const filteredHighlightStyle: filteredHighlightStyle = {}
        for (const key in highlightStyle) {
            const rating = key as keyof typeof usedRatings
            if (usedRatings[rating]) filteredHighlightStyle[rating as keyof typeof filteredHighlightStyle] = HIGHLIGHT_STYLE[rating]
        }

        return filteredHighlightStyle
    }

    function cleanDrag(target: HTMLElement) {
        if (target.dataset.dontcleandrag) return

        setDrag({ id: '', is: false })
    }

    function handleMouseDown(e: React.MouseEvent) {
        cleanDrag(e.target as HTMLElement)

        if (e.button === 2) {
            e.preventDefault()
            const element = e.currentTarget
            const elementRect = element.getBoundingClientRect()

            startArrow(e.clientX - elementRect.x, e.clientY - elementRect.y)
        } else {
            cleanArrows()
            setAnimation(false)
        }
    }

    function handleMouseUp(e: React.MouseEvent) {
        if (e.button === 2) {
            e.preventDefault()
            setAnimation(false)
            const element = e.currentTarget
            const elementRect = element.getBoundingClientRect()

            endArrow(e.clientX - elementRect.x, e.clientY - elementRect.y)
        }
    }

    function animateMove(element: HTMLElement, move: square[], zIndex: number, forward: boolean, white: boolean, squareSize: number) {
        if (move.length === 0) return
        const [from, to] = move
    
        const fromElementPosition = {
            bottom: squareSize * from.row,
            left: squareSize * from.col,
        }
    
        const toElementPosition = {
            bottom: squareSize * to.row,
            left: squareSize * to.col,
        }
    
        const distance = {
            x: (toElementPosition.left - fromElementPosition.left) * (white ? 1 : -1),
            y: (toElementPosition.bottom - fromElementPosition.bottom) * (white ? 1 : -1),
        }

        function resetElements() {
            if (!element) return
            element.style.zIndex = ''
            element.style.willChange = ''
        }

        element.style.zIndex = String(zIndex)
        element.style.willChange = 'transform'

        const animation = element.animate(
            [
                { transform: `translate(${forward ? -distance.x : 0}px, ${forward ? distance.y : 0}px)` },
                { transform: `translate(${!forward ? distance.x : 0}px, ${!forward ? -distance.y : 0}px)` },
            ],
            { duration: 150, easing: 'linear', direction: forward ? 'normal' : 'reverse' },
        )

        animation.finished.then(resetElements).catch(resetElements)
        animation.oncancel = resetElements
    }

    function getLegalMoves() {
        if (!drag.id) return []

        const moves = chess.moves({ square: drag.id as Square, verbose: true }).map(move => move.to)
        return moves
    }

    const legalMoves = getLegalMoves()

    const boardColors = [boardThemes[boardTheme].white, boardThemes[boardTheme].black]

    return (
        <div onContextMenu={e => e.preventDefault()} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} className="grid w-fit h-fit relative" style={{ gridTemplateColumns: `repeat(8, ${squareSize}px)`, pointerEvents: drag.is ? 'none' : 'unset' }}>
            <PreloadRatingImages highlightedStyle={filteredHighlightStyle} />
            {
                (() => {
                    const squares: JSX.Element[] = []
                    let rowNumber = white ? 0 : 7
                    for (const row of board) {
                        let columnNumber = white ? 0 : 7
                        for (const square of row) {
                            const squareId = getSquareId(columnNumber, rowNumber)

                            let bgColor, guideColor
                            if (isEven(rowNumber)) {
                                if (isEven(columnNumber)) {
                                    bgColor = boardColors[0]
                                    guideColor = boardColors[1]
                                } else {
                                    bgColor = boardColors[1]
                                    guideColor = boardColors[0]
                                }
                            } else {
                                if (isEven(columnNumber)) {
                                    bgColor = boardColors[1]
                                    guideColor = boardColors[0]
                                } else {
                                    bgColor = boardColors[0]
                                    guideColor = boardColors[1]
                                }
                            }

                            let squareNumGuide, squareLetterGuide
                            if (rowNumber === (white ? 7 : 0)) {
                                squareLetterGuide = <span style={{ right: rightSize, color: guideColor }} className={`absolute bottom-0`}>{squareId[0]}</span>
                            }
                            if (columnNumber === (white ? 0 : 7)) {
                                squareNumGuide = <span style={{ left: leftSize, color: guideColor }} className={`absolute top-0`}>{squareId[1]}</span>
                            }

                            let rounded: string = ''
                            if (rowNumber === 0 && columnNumber === 0) rounded = white ? 'rounded-tl-borderRoundness' : 'rounded-br-borderRoundness'
                            if (rowNumber === 7 && columnNumber === 0) rounded = white ? 'rounded-bl-borderRoundness' : 'rounded-tr-borderRoundness'
                            if (rowNumber === 0 && columnNumber === 7) rounded = white ? 'rounded-tr-borderRoundness' : 'rounded-bl-borderRoundness'
                            if (rowNumber === 7 && columnNumber === 7) rounded = white ? 'rounded-br-borderRoundness' : 'rounded-tl-borderRoundness'

                            const iconTranslateX = (white ? columnNumber === 7 : columnNumber === 0) ? -5 : 35
                            const iconTranslateY = (white ? rowNumber === 0 : rowNumber === 7) ? 5 : -35

                            const iconSize = squareSize / 2.4

                            let highlighted, highlightedIcon
                            move.forEach((square, i) => {
                                const highlightedSquare = adaptSquare(square)
                                if (highlightedSquare.col === columnNumber && highlightedSquare.row === rowNumber) {
                                    highlighted = <div style={{ backgroundColor: highlightColor }} className={`absolute z-[10] top-0 left-0 w-full h-full opacity-50 ${rounded}`} />
                                    if (i === 1) highlightedIcon = highlightIcon && i === 1 ? <Image style={{ transform: `translateX(${iconTranslateX}%) translateY(${iconTranslateY}%)`, width: iconSize }} className="absolute top-0 right-0 z-[80] pointer-events-none" alt="move-evaluation" src={`/images/rating/${highlightIcon}`} priority width={120} height={120} /> : ''
                                }
                            })

                            if (squareId === drag.id && !highlighted) {
                                highlighted = <div style={{ backgroundColor: boardThemes[boardTheme].highlight }} className={`absolute top-0 left-0 w-full h-full opacity-50 ${rounded}`} />
                            }

                            let resultIcon
                            if (isLastMove) {
                                if (square?.type === KING) {
                                    if (result === '1/2-1/2') {
                                        resultIcon = <Image className="absolute top-0 right-0 z-[60]" style={{ transform: 'translateX(50%) translateY(-50%)', width: iconSize }} alt="draw" src="/images/results/draw.svg" priority width={120} height={120} />
                                    } else {
                                        if (square.color === WHITE) {
                                            if (result === '1-0') resultIcon = <Image className="absolute top-0 right-0 z-[60]" style={{ transform: `translateX(${iconTranslateX}%) translateY(${iconTranslateY}%)`, width: iconSize }} alt="victory" src="/images/results/victory.svg" priority width={120} height={120} />
                                            else if (result === '0-1') resultIcon = <Image className="absolute top-0 right-0 z-[60]" style={{ transform: `translateX(${iconTranslateX}%) translateY(${iconTranslateY}%)`, width: iconSize }} alt="defeat" src="/images/results/defeat.svg" priority width={120} height={120} />
                                        } else {
                                            if (result === '0-1') resultIcon = <Image className="absolute top-0 right-0 z-[60]" style={{ transform: `translateX(${iconTranslateX}%) translateY(${iconTranslateY}%)`, width: iconSize }} alt="victory" src="/images/results/victory.svg" priority width={120} height={120} />
                                            else if (result === '1-0') resultIcon = <Image className="absolute top-0 right-0 z-[60]" style={{ transform: `translateX(${iconTranslateX}%) translateY(${iconTranslateY}%)`, width: iconSize }} alt="defeat" src="/images/results/defeat.svg" priority width={120} height={120} />
                                        }
                                    }
                                }
                            }

                            const toAnimateSquare = forward ? move[1] : nextMove[0]
                            const adaptedToAnimateSquare = toAnimateSquare ? adaptSquare(toAnimateSquare) : { col: NaN, row: NaN }
                            const moved = adaptedToAnimateSquare.col === columnNumber && adaptedToAnimateSquare.row === rowNumber

                            const isCastleRook = forward ? (castleRookTo?.col === columnNumber && castleRookTo?.row === rowNumber) : (castleRookFrom?.col === columnNumber && castleRookFrom?.row === rowNumber)

                            const pieceColor = square?.color
                            const pieceType = square?.type
                            let piece
                            if (pieceColor && pieceType) {
                                const imageColor = PIECES_IMAGES[pieceColor as keyof object]
                                const pieceImages = imageColor[pieceType as keyof object]
                                piece = <Piece handleMouseDown={handleMouseDown} handleMouseUp={handleMouseUp} drag={drag} setDrag={setDrag} id={squareId} pieceRef={pieceRef} moved={moved} isCastleRook={isCastleRook} castleRookRef={castleRookRef} pieceType={pieceType} pieceColor={pieceColor} pieceImages={pieceImages} />
                            }

                            function handleSquareDragMouseEnter() {
                                setHoverDrag(squareId)
                            }

                            function handleSquareDragMouseLeave() {
                                setHoverDrag('')
                            }

                            const hoverDragSquare = <div style={{ display: drag.is ? '' : 'none',  opacity: hoverDrag === squareId ? '100' : '' }} onMouseEnter={handleSquareDragMouseEnter} onMouseLeave={handleSquareDragMouseLeave} className="absolute top-0 z-[30] left-0 w-full h-full border-[5px] border-opacity-65 opacity-0 block border-white pointer-events-auto" />

                            const legalMove = legalMoves.includes(squareId as Square) ? (
                                piece ?
                                    <div className="absolute w-full h-full z-[40] top-0 left-0 cursor-grab"><div style={{ borderWidth: squareSize * 0.12 }} className="border-black opacity-[15%] w-full h-full rounded-full" /></div>
                                :
                                    <div className="absolute top-1/2 left-1/2 translate-x-[-50%] translate-y-[-50%] bg-black opacity-[15%] z-[30] w-[30%] h-[30%] rounded-full" />
                            ) : null

                            const col = columnNumber
                            function handleSquareClick() {
                                if (window.innerWidth < maxVertical) {
                                    if (white) {
                                        if (col < 4) controller.back()
                                        else controller.forward()
                                    } else {
                                        if (col < 4) controller.forward()
                                        else controller.back()
                                    }
                                }
                            }

                            squares.push(<div onClick={handleSquareClick} data-square={squareId} key={squareId} style={{ height: squareSize + 'px', width: squareSize + 'px', fontSize: guideSize, backgroundColor: bgColor }} className={`font-bold relative ${rounded}`}>{squareNumGuide}{squareLetterGuide}{piece}{highlighted}{resultIcon ? null : highlightedIcon}{resultIcon}{hoverDragSquare}{legalMove}</div>)

                            if (square) {
                                if (square?.color === WHITE) {
                                    newMaterialAdvantage += PIECES_VALUES[square.type as keyof typeof PIECES_VALUES]
                                } else {
                                    newMaterialAdvantage -= PIECES_VALUES[square.type as keyof typeof PIECES_VALUES]
                                }
                            }

                            white ? columnNumber++ : columnNumber--
                        }
                        white ? rowNumber++ : rowNumber--
                    }
                    return squares
                })()
            }
            {
                (() => {
                    if (!showArrows) return

                    if (arrowAfterMove && moveRating === 'book') return

                    const move = arrowAfterMove ? previousBestMove : bestMove
                    const adaptedMove = move?.map(square => {
                        return adaptSquare(square)
                    })

                    return adaptedMove ? <Arrow move={adaptedMove} squareSize={squareSize} class="fill-bestArrow stroke-bestArrow" white={white} /> : ''
                })()
            }
            {
                arrows.map((move, i) => {
                    const singleSquare = JSON.stringify(move[0]) === JSON.stringify(move[1])

                    return <Arrow key={i} move={singleSquare ? [move[0]] : move} squareSize={squareSize} class={singleSquare ? "bg-badArrow" : "fill-normalArrow stroke-normalArrow"} white={white} />
                })
            }
        </div>
    )
}