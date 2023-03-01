import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  const profile = {
    url: "https://ervin-sungkono.vercel.app",
    title: "Ervin Cahyadinata Sungkono",
    description: "Hello! im known as Ervin Cahyadinata Sungkono, a student at Binus University who has a passion for Web Development and Web Design. This is my personal website where i put my past projects and designs.",
    imagePath: "https://ervin-sungkono.vercel.app/images/preview-img.png"
  }
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" href="/favicon.ico" type="image/x-icon"/>

        <meta name="title" content={profile.title}/>
        <meta name="description" content={profile.description}/>
        <meta name="image" content={profile.imagePath}/>

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website"/>
        <meta property="og:url" content={profile.url}/>
        <meta property="og:title" content={profile.title}/>
        <meta property="og:description" content={profile.description}/>
        <meta property="og:image" content={profile.imagePath}/>

        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image"/>
        <meta property="twitter:url" content={profile.url}/>
        <meta property="twitter:title" content={profile.title}/>
        <meta property="twitter:description" content={profile.description}/>
        <meta property="twitter:image" content={profile.imagePath}/>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
