export function ScrollIntoView(options = {}){
    if(!options.id) return
    document.getElementById(options.id).scrollIntoView({
        behavior: options.behavior ?? 'smooth',
        block: options.block ?? 'start'
    })
}