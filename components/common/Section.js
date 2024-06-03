export default function Section({ title, children, className, ...props }){
    return (
        <section {...props} className={`${className} py-8 md:py-12`}>
            <h2>{ title }</h2>
            <div className="hr"></div>
            { children }
        </section>
    )
}