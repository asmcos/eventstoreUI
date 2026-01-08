import { create_browselog } from "./esclient";
import { WebStorage } from "./WebStorage";

import {
    generateSecretKey,
    getPublicKey,
    esecEncode,
    esecDecode,
  } from "eventstore-tools/src/key";


let store ; 

function newpubkey(){
    if (!store) store = new WebStorage(localStorage);

    let npriv;

    npriv = store.get("anonymousprivkey")

 
    if (npriv != null){

        const numArray = npriv.split(',').map(Number);
        npriv = new Uint8Array(numArray)
        return getPublicKey(npriv) // `pk` is a hex string
    } 
 
    npriv = generateSecretKey();
   
    console.log(npriv)

    store.set("anonymousprivkey", npriv)
    
    return getPublicKey(npriv) ;
}

export function browselog(pubkey,targetId){
    if (!store) store = new WebStorage(localStorage);

    if (!pubkey) pubkey = newpubkey();

    console.log(pubkey)
    create_browselog(pubkey,targetId,function(e){
    })
}

