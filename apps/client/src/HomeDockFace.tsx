import ivoryDock from '../../../packages/assets/home-dock-v75/runtime/ivory-dock.webp';
/** Authored nine-slice surface shared by the home command dock and navigation. */
export default function HomeDockFace(){
 return <span className="home-dock-face" aria-hidden="true" style={{borderImageSource:`url(${ivoryDock})`}}/>;
}
