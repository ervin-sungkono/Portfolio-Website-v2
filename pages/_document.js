import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  const profile = {
    url: "https://ervin-sungkono.vercel.app",
    title: "Ervin Cahyadinata Sungkono",
    description: "Hello! im known as Ervin Cahyadinata Sungkono, a student at Binus University who has a passion for Web Development and Web Design. This is my personal website where I put my past projects and designs.",
    imagePath: "/images/preview-img.png"
  }
  return (
    <Html lang="en">
      <Head>
        <title key={"site-title"}>{profile.title}</title>
        <meta key={"site-desc"} name="description" content={profile.description}/>
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        <link rel="icon" href="/images/favicon-light.png" type='image/png' media="(prefers-color-scheme: light)"/>
        <link rel="icon" href="/images/favicon-dark.png" type='image/png' media="(prefers-color-scheme: dark)"/>

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
