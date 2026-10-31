// Verified aliases only: unknown similar names are preserved, never guessed.
export const NAME_ALIASES={
 'กฤษดา':'กฤษฎา',
 'กชภิกา':'กชนิภา',
 'สทธิเกียรติ':'สุทธิเกียรติ'
};
export function canonicalName(raw){
 const cleaned=String(raw??'').normalize('NFC').trim().replace(/^(?:นพ\.|พญ\.|พ\.)\s*/,'').replace(/\s+/g,' ');
 return NAME_ALIASES[cleaned]||cleaned;
}
