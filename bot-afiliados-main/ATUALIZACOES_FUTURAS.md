# Bot Afiliados — guia para futuras atualizações

## Estrutura que deve ser preservada
- `/index.html`, `/style.css`, `/app.js`: painel principal do Bot Afiliados.
- `/ofertas/`: vitrine pública dos clientes.
- `/supabase/`: SQL e Edge Functions.
- `/site-config.js`: rotas públicas centralizadas.

## Regra importante do GitHub Pages
Este projeto é publicado em `/bot-afiliados/`, não na raiz `gustavo2025001.github.io/`.
Não use `../` para voltar ao Bot a partir de páginas públicas quando isso puder sair do projeto.

URL oficial do Bot:
`https://gustavo2025001.github.io/bot-afiliados/#bot`

## Vitrine por cliente
A vitrine continua separada por cliente e deve usar o identificador/slug do cliente para buscar apenas os produtos daquele afiliado.
Nunca trocar o `affiliate_url` do cliente por um link global.

## Próximas evoluções previstas
1. Slug amigável de vitrine (ex.: `/ofertas/gustavobarbosa`) sem expor UUID.
2. Botão “Minha Vitrine” no painel do assinante.
3. Configuração por cliente: nome da loja, logo, Instagram e outras redes.
4. Categorias vindas dos dados reais dos produtos.
5. Vitrine multiplataforma para Shopee e Mercado Livre.
6. Centralizar novas rotas em `site-config.js`.
7. Manter credenciais, secrets e tokens somente no backend/Supabase; nunca no frontend/GitHub.

## Publicação
Antes de enviar uma atualização:
- preservar a pasta `/ofertas/`;
- preservar autenticação e integrações existentes;
- testar `/bot-afiliados/`;
- testar `/bot-afiliados/#bot`;
- testar a vitrine com um cliente;
- testar os CTAs “ENTRAR NO BOT” e “QUERO CONHECER”.
