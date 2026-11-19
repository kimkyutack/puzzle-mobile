/** Android reserves native system-bar space for the entire WebView, including art.
 * iOS keeps viewport-fit=cover and the existing CSS safe-area layout.
 */
export function configureViewport(platform:string,viewport:Pick<HTMLMetaElement,'content'>|null){
 if(platform!=='android'||!viewport)return;
 const values=viewport.content.split(',').map(value=>value.trim()).filter(value=>!/^viewport-fit\s*=/i.test(value));
 viewport.content=[...values,'viewport-fit=contain'].join(',');
}
