export const token=location.hash.slice(1)||sessionStorage.getItem('hot-token')||'';
if(location.hash){sessionStorage.setItem('hot-token',token);history.replaceState(null,'',location.pathname);}
export async function api<T>(url:string,init:RequestInit={}):Promise<T>{const response=await fetch(url,{...init,headers:{'x-hot-token':token,...init.headers}});const data=await response.json();if(!response.ok)throw new Error(data.error||'Request failed');return data;}
