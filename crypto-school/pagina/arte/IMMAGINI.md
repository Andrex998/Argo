# Le immagini della Scuola Cripto (Higgsfield)

Generate il 26/11/2026 con il modello **Soul Cinema** di Higgsfield, nello stesso stile
"render da videogioco AAA" per tutti: Unreal Engine 5, realismo stilizzato da gioco di
ruolo, luce calda dorata, palette verde petrolio, antracite e oro, con un colore per
personaggio. Sono personaggi inventati: nessun dato dell'utente nei prompt.

Gli originali stanno sull'account Higgsfield del proprietario (l'ambiente "argo" ora
permette l'host `d8j0ntlcm91z4.cloudfront.net`). Le versioni per la pagina sono in questa
cartella, in WebP, e si pubblicano accanto alla pagina con la mappa `files`:

- `copertina.webp` (1920×1080) e `copertina-piccola.webp` (960×540): la schermata del titolo;
- `ritratto-<chi>.webp` (480×640): i dialoghi;
- `figura-<chi>.webp` (alta 1100, sfondo trasparente): la scheda dei personaggi;
- `stemma-<chi>.webp` e `stemma-scuola.webp` (alti 420, sfondo trasparente): porte,
  stendardi e interfaccia.

Lo sfondo è tolto con un riempimento dai bordi sul colore dello studio, poi il bordo è
ristretto di un pixel e sfumato.

| Chi | Uso | Formato | Job Higgsfield |
| --- | --- | --- | --- |
| Preside (stola cremisi) | ritratto | 3:4, 1536×2048 | 8c048b99-c8d4-4813-8a10-8cfcabcbee0f |
| Falco (ambra) | ritratto | 3:4 | 7d1490ff-3f79-4610-91c7-e2d484127c13 |
| Tartaruga (verde muschio) | ritratto | 3:4 | 4ed776ba-f0e0-43a0-b11f-b81dc1a1596b |
| Spazzino (arancio ruggine) | ritratto | 3:4 | 8695e24c-e8b4-4191-a8d7-d1a343646499 |
| Ragioniere (blu navy) | ritratto | 3:4 | fba8b764-1e24-4f9c-ad5f-356ba39d55cc |
| Guardiano (verde petrolio) | ritratto | 3:4 | 351c7cdd-b14c-4eb8-ac66-2ad7e737fc1e |
| Cronista (magenta) | ritratto | 3:4 | 2318d8ca-ee80-485c-b62b-de7b60ffac86 |
| Scettico (viola) | ritratto | 3:4 | 5cfe77f2-9561-49aa-a485-d81bc5fb263c |
| La scuola all'alba | copertina e schermata del titolo | 16:9, 2048×1152 | eff0390c-4bac-497d-b3d5-803faf57ff2a |

## Figure intere per i modelli 3D e la scelta del personaggio

Generate il 26/11/2026 con Soul Cinema, **solo con la descrizione** del personaggio: in
piedi, di fronte, a braccia leggermente aperte (la "posa ad A"), su fondo grigio chiaro e a
mani vuote. È la foto che serve a Meshy (Higgsfield, modello 3D da immagine) per costruire
il corpo e lo scheletro. Formato 9:16, 1152×2048.

| Chi | Job Higgsfield |
| --- | --- |
| Preside | 99e38f05-65f6-458d-b05a-88a76a454754 |
| Falco | a6039b42-3888-4115-a7d4-a24b7499d333 |
| Tartaruga | c642b347-79d1-4255-8227-0f06a93df359 |
| Spazzino | d0214a94-d929-4de8-955b-c7e5a63c983c |
| Ragioniere | 22a078ff-3a9c-4433-931a-c05657bdf26c |
| Guardiano | 981d1204-ed89-40a7-abb2-e574e8605127 |
| Cronista | b5ab8b5b-080c-4c79-a1bc-2110305b299f |
| Scettico | fe34190c-290d-4d52-b54a-01d4e4a120d6 |

**Un tentativo andato storto, da non ripetere.** Il primo giro passava a Soul Cinema il
ritratto come immagine di riferimento. Con un riferimento il modello **ignora il testo**
(nel job il prompt risulta vuoto) e rifà il ritratto in versione fotografica a mezzo
busto. Quegli otto job (56f3b774, 61da3168, f0452e2a, 2d534728, 4d068314, 559a91b1,
91f18731, 0f3f0a2a) non sono figure intere e non si usano. Le facce delle figure buone
quindi non sono identiche ai ritratti, ma la descrizione è la stessa.

## Stemmi

Uno per la scuola e uno per il dormitorio di ogni personaggio: scudo in oro e smalto del
suo colore, su fondo antracite, senza scritte. Servono per le porte dei dormitori, le
icone dell'interfaccia e gli stendardi. Formato 1:1, 2048×2048.

| Stemma | Simbolo | Job Higgsfield |
| --- | --- | --- |
| Scuola | la nave Argo e tre candele che salgono, corona d'alloro | a094f9bf-7431-4846-aff5-21c6d20209ac |
| Preside (cremisi) | chiave e libro aperto | 67991a12-5f34-421b-a6a8-8ba38997b574 |
| Falco (ambra) | falco in picchiata e freccia che sale | 6fe37309-6f2c-45bc-a939-7cf0cd16e4dd |
| Tartaruga (verde muschio) | tartaruga su una lunga curva che sale piano | d9539059-4beb-4379-b4ca-63b5532c0a50 |
| Spazzino (arancio ruggine) | scopa e freccia che scende e risale | df834d22-ba79-4cfe-b66d-8ed1fed88acb |
| Ragioniere (blu navy) | bilancia e clessidra | 02e73711-cbef-4a94-a75d-68ad264f69fc |
| Guardiano (verde petrolio) | torre di guardia e occhio | 8d3fe137-fbf5-49d5-811e-a6bf91e7a433 |
| Cronista (magenta) | penna d'oca, campanella e pergamena | 9ff12cd7-b865-45cb-bbf1-fc36baf45db0 |
| Scettico (viola) | lente d'ingrandimento e civetta | c698694c-a6f6-4c49-b133-d5b544d2c55d |

**Piano per i modelli 3D (dopo il rinnovo del 6/12, 600 crediti).** Meshy v7 con
texture, scheletro e animazione costa circa 47,5 crediti a personaggio: prima un
personaggio pilota, poi gli altri sette se il risultato è buono (circa 380 crediti in tutto).

Un primo ritratto del Preside in stile "foto da film" (job 9b1ac0cd-6fd1-4216-acea-034930a47a46)
è stato sostituito da quello in stile videogioco.

Gli indirizzi dei file seguono lo schema
`https://d8j0ntlcm91z4.cloudfront.net/user_<id account>/hf_<data>_<job>.png`; lo strumento
`show_generation_by_ids` di Higgsfield li restituisce dal numero del job.

**Prossime immagini previste:** un panorama a 360° del campus per la luce della scena 3D,
i materiali (legno, marmo, tappeti), i poster dei dormitori e gli interni (sala trading,
biblioteca).
