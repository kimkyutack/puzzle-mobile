import './startup-poster.css';

/** Bootstrap artwork is independent of the game atlas and is preloaded by index.html. */
export default function StartupPoster({className='',alt=''}:{className?:string;alt?:string}){
 return <picture className={'startup-poster '+className}>
  <source media="(min-aspect-ratio: 1/1)" srcSet="/splash/garden-build-wide-v52.webp"/>
  <img src="/splash/garden-build-v52.webp" alt={alt} fetchPriority="high" decoding="sync"/>
 </picture>;
}
