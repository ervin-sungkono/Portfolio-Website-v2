import Head from "next/head";
import Navbar from "./Navbar";
import Footer from "./Footer";

export default function Layout({title, children}){
    return(
        <>
            <Head>
                <title>{title}</title>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </Head>
            <Navbar/>
            <main className="container mx-auto pt-20 lg:pt-18">
                {children}
            </main>
            <Footer/>
        </>
    )
}