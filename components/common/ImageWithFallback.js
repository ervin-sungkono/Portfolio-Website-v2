import { useState } from 'react';
import Image from 'next/image';

export default function ImageWithFallback({src, fallbackSrc, ...rest}){
    const [imgSrc, setImgSrc] = useState(src)

    return (
        <Image
            {...rest}
            src={imgSrc}
            onError={() => {
                setImgSrc(fallbackSrc)
            }}
        />
    )
}