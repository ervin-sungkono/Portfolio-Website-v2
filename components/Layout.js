import Head from "next/head";
import Navbar from "./Navbar";
import Footer from "./Footer";

export default function Layout({title, children}){
    return(
        <>
            <Head>
                <title>{title}</title>
            </Head>
            <Navbar/>
            <main className="container mx-auto pt-20">
                {children}
            </main>
            <Footer/>
        </>
    )
}