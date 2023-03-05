import { ThemeProvider } from 'next-themes'
import { useEffect, useState } from 'react'
import Aos from 'aos'

import '../styles/globals.css'
import '../styles/main.scss'
import 'aos/dist/aos.css'

export default function App({ Component, pageProps }) {
  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => {
    setIsMounted(true)
    Aos.init({
      offset: (window.innerHeight * 0.15),
      easing: 'ease-out-back',
      duration: 700,
    })
    Aos.refresh();
    let timeout;
    window.addEventListener('resize', () => {
      clearTimeout(timeout)
      timeout = setTimeout(() => Aos.refresh(), 100)
    })
  })
  return (
    <ThemeProvider attribute='class' enableSystem={false}>
      {isMounted && <Component {...pageProps} />}
    </ThemeProvider>
  )
}
