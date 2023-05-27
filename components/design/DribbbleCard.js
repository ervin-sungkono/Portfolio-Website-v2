import Link from "next/link"
import ImageWithFallback from "../common/ImageWithFallback"

export default function DribbbleCard({ shot }){
    return(
        <Link href={shot.html_url} target="_blank">
            <ImageWithFallback
                src={shot.images.normal}
                fallbackSrc={`https://raw.githubusercontent.com/ervin-sungkono/web-assets/master/images/no-image.png`}
                fill
                alt={shot.title}
            />
            <div className="shot-overlay bg-black/[0.6] dark:bg-white/[0.7]">
                <h3>{shot.title}</h3>
            </div>
        </Link>
    )
}