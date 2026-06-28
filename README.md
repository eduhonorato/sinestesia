Um experimento audiovisual focado em raycasting, arte generativa e visualização reativa ao áudio.

O projeto renderiza, em tempo real, feixes de luz que se refletem dentro de geometrias poligonais, criando composições visuais dinâmicas inteiramente desenhadas em Canvas. Além da integração com análise espectral de áudio, o sistema oferece um Modo VJ, permitindo separar a interface de controle da saída de vídeo para performances ao vivo.

## Principais Features

* **Integração VJ (Spout):** Preparado para roteamento de vídeo via Spout, permitindo enviar o canvas diretamente para softwares como Resolume Arena, MadMapper ou TouchDesigner com baixa latência e preservação da qualidade da imagem.
* **Modo Control Room (IPC Bridge):** Execução em duas janelas independentes: uma dedicada ao controle da aplicação e outra exclusiva para projeção. Os parâmetros permanecem sincronizados via IPC, mantendo a interface completamente oculta da saída final.
* **Motor de Raycasting:** Sistema de cálculo vetorial responsável pela propagação e reflexão dos feixes de luz em tempo real, suportando múltiplos bounces dentro da geometria.
* **Áudio Reativo nativo:** Análise espectral utilizando p5.sound e FFT. Propriedades como brilho, cor, intensidade e geração de novos feixes podem responder dinamicamente às frequências do áudio.
* **Piloto Automático:** Algoritmos capazes de detectar órbitas fechadas (loops perfeitos), além de rotação automática da cena para manter a composição visual em constante movimento durante performances.

## Stack Tecnológico

* **[p5.js](https://p5js.org/):** Renderização em Canvas e matemática vetorial 2D.
* **p5.sound:** Captura e análise de áudio utilizando FFT.
* **[Tweakpane](https://tweakpane.github.io/):** Interface de controle para ajuste de parâmetros em tempo real.
* **Spout / Syphon:** Compartilhamento de textura de vídeo com aplicações VJ.

## Como Rodar Localmente

Por usar a API de áudio do navegador (`MediaDevices`), o projeto exige um contexto seguro ou localhost para acessar o microfone.

1. Clone o repositório.
2. Abra a pasta no VSCode e inicie um servidor local (ex: extensão *Live Server*).
3. Acesse `http://localhost:5500` (ou a porta correspondente).

> **Dicas de Roteamento para VJs:** > * **Áudio:** Instale um cabo virtual (como o **VB-Cable**) e defina-o como saída padrão do Windows para o visual reagir ao áudio do desktop/Spotify/DAW.

## Como spout no Resolume

<img width="1794" height="979" alt="image" src="https://github.com/user-attachments/assets/50969f82-a344-4bec-88a8-55d76e659be0" />

## Exemplos de imagens geradas

<img width="1920" height="945" alt="laser-339" src="https://github.com/user-attachments/assets/bfd8cb79-dfc2-4e70-8926-73b56c1f4235" />
<img width="1920" height="945" alt="laser-1166" src="https://github.com/user-attachments/assets/e64430cf-d661-4036-bd44-8b7c7840b43e" />
<img width="1920" height="945" alt="laser-9670" src="https://github.com/user-attachments/assets/3e03978d-8a9b-4727-b362-ec35197dce3d" />
<img width="1920" height="945" alt="laser-5690" src="https://github.com/user-attachments/assets/beb3d550-7cf3-415c-9645-33ab9b043783" />
<img width="1920" height="945" alt="laser-3480" src="https://github.com/user-attachments/assets/550dfdc8-3b0d-4dc0-ab90-8ab9f09a58ff" />
<img width="1920" height="911" alt="laser-1859" src="https://github.com/user-attachments/assets/967ce76d-c1df-4381-b58b-0daec8c0ee5c" />
<img width="1920" height="945" alt="laser-5374" src="https://github.com/user-attachments/assets/e8f5b86c-11b6-4848-8ba6-4fa74aa01484" />
<img width="1920" height="945" alt="laser-6460" src="https://github.com/user-attachments/assets/37a3ac10-3fbf-4754-b2b2-f84ae33d4687" />
<img width="1920" height="945" alt="laser-10466" src="https://github.com/user-attachments/assets/51bb1b19-5dae-41e1-93c0-1797e38df9cb" />
<img width="1920" height="945" alt="laser-12824" src="https://github.com/user-attachments/assets/f19cd17e-e375-4df9-a8af-6588773e2702" />
<img width="1920" height="945" alt="laser-15112" src="https://github.com/user-attachments/assets/6cb15f6c-9673-4619-ba87-566998c9b5be" />
<img width="1920" height="945" alt="laser-7018" src="https://github.com/user-attachments/assets/402a8abd-db90-46b0-b7fc-ada4e292036c" />
<img width="1920" height="945" alt="laser-917" src="https://github.com/user-attachments/assets/05090688-7f73-4766-a094-668ca4314fd1" />
<img width="1920" height="945" alt="laser-6833" src="https://github.com/user-attachments/assets/c81d181e-e1c0-4ea7-a3a0-3bece0605b78" />


## 🚀 Demo online em: https://sinestesia-murex.vercel.app/

## Atalhos Úteis

A interface conta com atalhos de teclado para facilitar a performance:

* `V` - Alterna o Modo VJ (Esconde a UI para captura limpa)
* `Espaço` - Pausa/Continua a rotação automática
* `R` - Modo "Surpreenda-me" (Gera presets aleatórios)
* `N` - Dispara um novo feixe
* `C` - Limpa a tela (limpa o rastro dos feixes)
* `F` - Tela cheia
* `S` - Exporta um frame em PNG
* `G` - Grava um GIF de 3 segundos
* `H` - Abre o painel de ajuda na tela
