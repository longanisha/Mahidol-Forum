import ForumPost from '../components/ForumPost.jsx'
import { postList } from '../data/mockup.jsx'

function Discussions() {
    return (
        <>
        <div className='flex flex-col flex-1 overflow-y-auto'>
            <main className='flex-1 p-4 sm:p-6 lg:p-8'>
                <h1 className='text-3x1 font-bold text-gray-800 mb-6'>Tags Placeholder</h1>
                <ForumPost posts={ postList }/>
            </main>
        </div>
        </>
    )
}
export default Discussions