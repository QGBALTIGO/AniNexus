export const staticPages = {
  '/quem-somos': { eyebrow:'AniNexus', title:'Anime, descoberta e comunidade em português', body:[
    'O AniNexus foi criado para reunir em um só lugar informações de lançamento, catálogo, temporadas, listas pessoais e descoberta de animes para o público brasileiro.',
    'Nossa proposta é organizar dados públicos e conteúdo editorial em uma experiência rápida, acessível e pensada para desktop, celular, tablet e telas grandes.'
  ]},
  '/colabore': { eyebrow:'Comunidade', title:'Colabore com o AniNexus', body:['Ajude a melhorar títulos em português, disponibilidade de streaming, informações de dublagem e dados editoriais. Envie correções pelo formulário de contato e nossa equipe revisará a sugestão antes de publicar.']},
  '/termos-de-uso': { eyebrow:'Legal', title:'Termos de Serviço', body:['Ao usar o AniNexus, você concorda em utilizar a plataforma de forma lícita, sem tentar contornar controles de segurança, explorar vulnerabilidades ou interferir na experiência de outros usuários.','Contas podem ser suspensas em caso de abuso, fraude, automação maliciosa, spam ou violação de direitos de terceiros. Conteúdos, marcas, personagens e imagens de obras permanecem pertencentes aos respectivos titulares.']},
  '/politica-de-privacidade': { eyebrow:'Privacidade', title:'Política de Privacidade', body:['O AniNexus armazena apenas os dados necessários para operar contas, listas, preferências, segurança, suporte e métricas de produto. Senhas são armazenadas somente na forma de hash criptográfico.','Dados de sessão recebem prazo de expiração. Registros técnicos podem ser mantidos por período limitado para prevenção de fraude, segurança e diagnóstico. Você pode solicitar acesso, correção ou exclusão dos seus dados.']},
};

export const lists = [
  {slug:'melhores-animes-para-assistir',title:'Melhores animes para assistir',subtitle:'Os títulos mais bem avaliados e consistentes do catálogo.',sort:'SCORE',category:'Destaques'},
  {slug:'animes-mais-assistidos',title:'Animes mais assistidos',subtitle:'Os títulos com maior alcance e popularidade no momento.',sort:'POPULAR',category:'Destaques'},
  {slug:'animes-mais-aguardados',title:'Animes mais aguardados',subtitle:'Lançamentos e retornos que concentram mais expectativa.',sort:'POPULAR',status:'NOT_YET_RELEASED',category:'Destaques'},
  {slug:'animes-em-alta',title:'Animes em alta agora',subtitle:'Obras com crescimento de interesse e conversa neste momento.',sort:'TRENDING',category:'Destaques'},
  {slug:'filmes-de-anime',title:'Filmes de anime',subtitle:'Longas para assistir do começo ao fim em uma sessão.',sort:'SCORE',format:'MOVIE',category:'Formatos'},
  {slug:'animes-curtos',title:'Animes curtos para começar',subtitle:'Temporadas compactas e boas portas de entrada para novos gêneros.',sort:'POPULAR',format:'TV_SHORT',category:'Formatos'},
  {slug:'animes-de-acao',title:'Animes de ação',subtitle:'Combates, aventura e histórias de alta energia.',sort:'SCORE',genre:'Action',category:'Gêneros'},
  {slug:'animes-de-romance',title:'Animes de romance',subtitle:'Relações marcantes, encontros e histórias emocionais.',sort:'SCORE',genre:'Romance',category:'Gêneros'},
  {slug:'animes-de-fantasia',title:'Animes de fantasia',subtitle:'Mundos imaginários, magia e grandes jornadas.',sort:'SCORE',genre:'Fantasy',category:'Gêneros'},
  {slug:'animes-de-comedia',title:'Animes de comédia',subtitle:'Títulos leves, excêntricos e feitos para rir.',sort:'SCORE',genre:'Comedy',category:'Gêneros'},
  {slug:'animes-de-misterio',title:'Animes de mistério',subtitle:'Segredos, investigação e histórias que pedem atenção aos detalhes.',sort:'SCORE',genre:'Mystery',category:'Gêneros'},
  {slug:'animes-de-esporte',title:'Animes de esporte',subtitle:'Competição, evolução pessoal e espírito de equipe.',sort:'SCORE',genre:'Sports',category:'Gêneros'},
  {slug:'animes-de-terror',title:'Animes de terror',subtitle:'Suspense, horror psicológico e histórias sombrias.',sort:'SCORE',genre:'Horror',category:'Gêneros'},
];
