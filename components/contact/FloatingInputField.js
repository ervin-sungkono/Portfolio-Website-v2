export default function FloatingInputField({type = "text", name, label, textarea = false, row = 4, errorMessage = ""}){
    return(
        <div>
            <div className="relative">
                {
                    textarea ?
                    <textarea
                        id={name}
                        name={name}
                        className="block px-2.5 pb-2.5 pt-4 w-full text-sm md:text-base bg-transparent rounded-lg border-1 border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-blue-500 peer"
                        placeholder=" "
                        rows={row}
                    >
                    </textarea>
                    :
                    <input 
                        type={type}
                        id={name}
                        name={name}
                        className="block px-2.5 pb-2.5 pt-4 text-sm md:text-base w-full bg-transparent rounded-lg border-1 border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-blue-500 peer"
                        placeholder=" "
                    />
                }
                <label 
                    htmlFor={name}
                    className={`cursor-text text-sm md:text-base absolute text-gray-500 duration-300 transform -translate-y-4 scale-75 top-2 md:top-1 z-10 origin-[0] backdrop-blur-3xl px-2 peer-focus:px-2 peer-focus:text-blue-500 font-semibold peer-focus:font-semibold peer-placeholder-shown:font-normal peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 
                    ${textarea ? "peer-placeholder-shown:top-6" : "peer-placeholder-shown:top-1/2"} peer-focus:top-2 md:peer-focus:top-1 peer-focus:scale-75 peer-focus:-translate-y-4 left-1`}
                >
                    {label}
                </label>
            </div>
            {errorMessage && <p className="text-xs mt-2 text-red-700 dark:text-red-500">{errorMessage}</p>}
        </div>
    )
}