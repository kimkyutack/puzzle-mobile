import {useEffect,useRef} from 'react';
import './events-comfort-v15.css';
import {mountRasterSurface} from './RasterSurface';
/** Authored PNG frames live inside their DOM controls, so native momentum
 * scrolling moves the artwork and labels in the same compositor layer. */
export default function ArtSurface({scene}:{scene?:'home'|'play'|'greenhouse'|'terrace'|'pages_v9'}){
 const host=useRef<HTMLDivElement>(null);
 useEffect(()=>{const element=host.current;if(element)return mountRasterSurface(element,scene);},[scene]);
 return <div ref={host} className="art-surface" aria-hidden="true"/>;
}
