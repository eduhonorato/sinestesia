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