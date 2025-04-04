import License from "@/components/svg/license";
import PieceSVG from "@/components/svg/piece";
import { KING, QUEEN, WHITE } from "chess.js";
import Image from "next/image";
import Link from "next/link";

export default function Licenses() {
    return (
        <div className="flex-grow h-full">
            <header>
                <h1 className="text-4xl font-extrabold mx-auto mt-6 flex flex-row items-center gap-4 w-fit"><License draggable size={35} class="fill-foreground" />Licenses</h1>
            </header>
            <main className="grid grid-cols-3 p-14 gap-6">
                <section className="bg-backgroundBox p-6 w-full rounded-borderRoundness">
                    <h1 className="text-2xl font-bold flex flex-row items-center mx-auto mb-8 w-fit gap-2">
                        <div draggable role="img" aria-label="pieces" className="flex flex-row">
                            <PieceSVG className="rotate-[-20deg] relative top-1" piece={QUEEN} size={50} color={WHITE} />
                            <PieceSVG className="rotate-12 relative bottom-2 right-2" piece={KING} size={50} color={WHITE} />
                        </div>
                        Chess Pieces Images
                    </h1>
                    <ul className="text-lg">
                        <li>Created by: <Link target="_blank" className="text-blue-600 hover:underline font-bold" href="https://en.wikipedia.org/wiki/User:Cburnett">Cburnett</Link></li>
                        <li>License: <Link target="_blank" className="text-blue-600 hover:underline font-bold" href="https://www.gnu.org/licenses/gpl-3.0.html">GNU General Public License</Link></li>
                    </ul>
                </section>
                <section className="bg-backgroundBox p-6 w-full rounded-borderRoundness">
                    <h1 className="text-2xl font-bold flex flex-row items-center mx-auto mb-8 w-fit gap-2">
                        <div draggable className="flex flex-row mr-2 select-none">
                            <Image draggable={false} className="rotate-[-20deg]" alt="megaphone" src={`${process.env.NEXT_PUBLIC_BASE_PATH}/images/megaphone.svg`} width={50} height={0} />
                        </div>
                        Board Sounds
                    </h1>
                    <ul className="text-lg">
                        <li>Created by: <Link target="_blank" className="text-blue-600 hover:underline font-bold" href="https://github.com/lichess-org">Lichess</Link></li>
                        <li>License: <Link target="_blank" className="text-blue-600 hover:underline font-bold" href="https://www.gnu.org/licenses/agpl-3.0.html">GNU Affero General Public License</Link></li>
                    </ul>
                </section>
            </main>
        </div>
    )
}