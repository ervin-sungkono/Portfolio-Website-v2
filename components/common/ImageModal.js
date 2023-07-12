import { useState } from "react"

import { AiOutlineClose } from "@react-icons/all-files/ai/AiOutlineClose"
import ImageWithFallback from "./ImageWithFallback"

export default function ImageModal({ children, imageSrc, imageAlt }){
    const [isVisible, setVisible] = useState(false)

    return(
        <>
            {isVisible && 
            <div className="fixed top-0 left-0 p-4 md:p-6 w-full h-screen bg-black/70 flex justify-center items-center z-fixed">
                <div className="relative w-full max-w-4xl max-h-[80vh]" style={{aspectRatio: '16 / 10'}}>
                    <button className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 p-1 md:p-2 bg-white shadow-md rounded-full border border-black/30 text-black z-20" onClick={() => setVisible(false)}>
                        <AiOutlineClose className="text-xl md:text-2xl"/>
                    </button>
                    <ImageWithFallback
                        src={imageSrc}
                        fallbackSrc={`https://raw.githubusercontent.com/ervin-sungkono/web-assets/master/images/no-image.png`}
                        fill
                        alt={imageAlt}
                        className="object-contain"
                    />
                </div>
            </div>}
            <div className='cursor-pointer' onClick={() => setVisible(true)}>
                {children}
            </div>
        </>
    )
}