import { Bilingual } from '../core/types';

export type EntryCategory = 'era' | 'trade' | 'economy' | 'society' | 'place' | 'event' | 'technology';

export interface Source {
  title: string;
  url: string;
}

export interface Entry {
  id: string;
  category: EntryCategory;
  title: Bilingual;
  period: string;
  summary: Bilingual;
  body: { ms: string[]; en: string[] };
  /** how the topic appears in the game */
  inGame: Bilingual;
  sources: Source[];
  related: string[];
}

export const CATEGORY_NAMES: Record<EntryCategory, Bilingual> = {
  era: { ms: 'Era', en: 'Eras' },
  trade: { ms: 'Perdagangan', en: 'Trade' },
  economy: { ms: 'Ekonomi', en: 'Economy' },
  society: { ms: 'Masyarakat & Pentadbiran', en: 'Society & Government' },
  place: { ms: 'Tempat & Binaan', en: 'Places & Buildings' },
  event: { ms: 'Peristiwa', en: 'Events' },
  technology: { ms: 'Teknologi', en: 'Technology' },
};

const W = (path: string) => `https://en.wikipedia.org/wiki/${path}`;

const E = (e: Entry) => e;

export const ENTRIES: Entry[] = [
  // ---------------------------------------------------------------- Eras
  E({
    id: 'era_entrepot',
    category: 'era',
    period: 'c. 2nd century – 1511',
    title: { ms: 'Zaman Entrepôt Maritim', en: 'The Maritime Entrepôt Age' },
    summary: {
      ms: 'Pelabuhan Selat Melaka makmur sebagai tempat persinggahan antara India, Asia Barat dan China.',
      en: 'Ports on the Straits of Melaka prospered as way-stations between India, West Asia and China.',
    },
    body: {
      ms: [
        'Kedudukan Semenanjung di tengah laluan angin monsun menjadikan pantai baratnya tempat kapal berlabuh sambil menunggu tukar angin. Tapak seperti Sungai Batu di Lembah Bujang menunjukkan kegiatan pelabuhan dan peleburan besi sejak sekitar abad ke-2 Masihi.',
        'Kemuncak zaman ini ialah Kesultanan Melaka (sekitar 1400–1511), sebuah entrepôt tempat barang dari Gujerat, China, Jawa dan Kepulauan Rempah ditukar. Pelabuhannya diurus oleh syahbandar dan dikawal undang-undang laut.',
      ],
      en: [
        'The peninsula sits astride the monsoon sea lanes, so its west coast became a place where ships anchored while waiting for the winds to change. Sites such as Sungai Batu in the Bujang Valley show port activity and iron smelting from around the 2nd century AD.',
        'The age peaked with the Melaka Sultanate (c. 1400–1511), an entrepôt where goods from Gujarat, China, Java and the Spice Islands changed hands. Its port was run by harbour masters (shahbandar) under a maritime legal code.',
      ],
    },
    inGame: {
      ms: 'Mulakan dengan pelabuhan dan kampung tepi sungai. Eksport rempah, timah dan barangan buatan kepada rakan dagang.',
      en: 'Start with a harbour and riverside kampung. Export spices, tin and crafts to trade partners.',
    },
    sources: [
      { title: 'Bujang Valley (Wikipedia)', url: W('Bujang_Valley') },
      { title: 'Malacca Sultanate (Wikipedia)', url: W('Malacca_Sultanate') },
    ],
    related: ['lembah_bujang', 'sungai_batu', 'kesultanan_melaka', 'entrepot', 'monsun'],
  }),
  E({
    id: 'era_timah',
    category: 'era',
    period: '1824 – 1955',
    title: { ms: 'Era Bijih Timah, Getah & Kereta Api', en: 'The Tin, Rubber & Rail Era' },
    summary: {
      ms: 'Ekonomi eksport komoditi dibina di atas lombong timah, estet getah dan landasan kereta api.',
      en: 'A commodity export economy built on tin mines, rubber estates and railways.',
    },
    body: {
      ms: [
        'Selepas Perjanjian Inggeris-Belanda 1824, pengaruh British di Tanah Melayu berkembang. Penemuan bijih timah di Larut (1848) dan Lembah Kinta menarik ramai pelombong, kebanyakannya dari China.',
        'Landasan kereta api pertama (Taiping–Port Weld, 1885) dibina untuk membawa bijih ke laut. Getah, yang ditanam di Kuala Kangsar sejak 1877, menjadi komoditi utama apabila permintaan tayar kereta melonjak awal abad ke-20.',
      ],
      en: [
        'After the Anglo-Dutch Treaty of 1824, British influence in the Malay states grew. Tin finds in Larut (1848) and the Kinta Valley drew large numbers of miners, many from China.',
        'The first railway (Taiping–Port Weld, 1885) was built to carry ore to the coast. Rubber, planted at Kuala Kangsar from 1877, became a leading export as demand for car tyres soared in the early 20th century.',
      ],
    },
    inGame: {
      ms: 'Bina lombong di kaki bukit kaya timah dan hubungkan dengan pelabuhan menggunakan landasan kereta api.',
      en: 'Build mines in tin-rich foothills and link them to the port by rail.',
    },
    sources: [
      { title: 'British Malaya (Wikipedia)', url: W('British_Malaya') },
      { title: 'Taiping railway station (Wikipedia)', url: W('Taiping_railway_station') },
    ],
    related: ['perjanjian_1824', 'larut', 'kereta_api', 'getah', 'kapal_korek'],
  }),
  E({
    id: 'era_merdeka',
    category: 'era',
    period: '1957 – 1995',
    title: { ms: 'Perindustrian Pasca-Merdeka', en: 'Post-Merdeka Industrialisation' },
    summary: {
      ms: 'Negara baharu mempelbagaikan ekonomi daripada timah dan getah kepada pembuatan.',
      en: 'The new nation diversified from tin and rubber into manufacturing.',
    },
    body: {
      ms: [
        'Persekutuan Tanah Melayu merdeka pada 31 Ogos 1957 dan Malaysia dibentuk pada 16 September 1963. Tanah rancangan membuka ladang getah dan kelapa sawit untuk peneroka.',
        'Zon perdagangan bebas (bermula dengan Bayan Lepas, 1972) menarik kilang elektronik antarabangsa, manakala projek kereta nasional (1983–1985) menandakan cita-cita perindustrian berat.',
      ],
      en: [
        'The Federation of Malaya became independent on 31 August 1957 and Malaysia was formed on 16 September 1963. Land development schemes opened rubber and oil palm smallholdings for settlers.',
        'Free trade zones (starting with Bayan Lepas, 1972) attracted international electronics plants, while the national car project (1983–1985) signalled heavy-industry ambitions.',
      ],
    },
    inGame: {
      ms: 'Bekalan elektrik dan air kini diperlukan untuk pembangunan padat. Bina zon perdagangan bebas dan kilang.',
      en: 'Power and water are now needed for dense development. Build free trade zones and factories.',
    },
    sources: [
      { title: 'Malayan Declaration of Independence (Wikipedia)', url: W('Malayan_Declaration_of_Independence') },
      { title: 'Bayan Lepas Free Industrial Zone (Wikipedia)', url: W('Bayan_Lepas_Free_Industrial_Zone') },
    ],
    related: ['merdeka', 'malaysia_1963', 'felda', 'bayan_lepas', 'kereta_nasional', 'deb'],
  }),
  E({
    id: 'era_digital',
    category: 'era',
    period: '1996 – today',
    title: { ms: 'Era Bandar Pintar Digital', en: 'The Digital Smart City Era' },
    summary: {
      ms: 'Dari Koridor Raya Multimedia kepada ekonomi digital dan pengangkutan awam moden.',
      en: 'From the Multimedia Super Corridor to a digital economy and modern public transport.',
    },
    body: {
      ms: [
        'Koridor Raya Multimedia (MSC) dilancarkan pada 1996, bersama bandar baharu Cyberjaya dan Putrajaya. Lapangan terbang antarabangsa baharu dibuka pada 1998 dan menara berkembar terkenal Kuala Lumpur siap pada akhir 1990-an.',
        'Abad ke-21 menyaksikan rangkaian MRT (laluan Sungai Buloh–Kajang beroperasi sepenuhnya pada 2017) dan Rangka Tindakan Ekonomi Digital MyDIGITAL (2021).',
      ],
      en: [
        'The Multimedia Super Corridor (MSC) was launched in 1996 together with the new cities of Cyberjaya and Putrajaya. A new international airport opened in 1998 and Kuala Lumpur’s famous twin towers were completed in the late 1990s.',
        'The 21st century brought the MRT network (the Sungai Buloh–Kajang line became fully operational in 2017) and the MyDIGITAL Digital Economy Blueprint (2021).',
      ],
    },
    inGame: {
      ms: 'Bina pusat data, hab inovasi dan MRT. Siapkan Menara Berkembar untuk menang.',
      en: 'Build data centres, innovation hubs and MRT. Complete the Twin Towers to win.',
    },
    sources: [
      { title: 'MSC Malaysia (Wikipedia)', url: W('MSC_Malaysia') },
      { title: 'MRT Kajang Line (Wikipedia)', url: W('MRT_Kajang_line') },
    ],
    related: ['msc', 'mrt', 'klia', 'menara_berkembar', 'mydigital'],
  }),

  // ---------------------------------------------------------------- Era 1 topics
  E({
    id: 'lembah_bujang',
    category: 'place',
    period: 'c. 2nd – 14th century',
    title: { ms: 'Lembah Bujang (Kedah Tua)', en: 'Bujang Valley (Old Kedah)' },
    summary: {
      ms: 'Kompleks arkeologi di Kedah dengan candi bata dan tapak pelabuhan purba.',
      en: 'An archaeological complex in Kedah with brick candi and ancient port sites.',
    },
    body: {
      ms: [
        'Lembah Bujang di kaki Gunung Jerai mengandungi berpuluh tapak candi dan pelabuhan yang dikaitkan dengan kerajaan Kedah Tua. Ia menjadi titik persinggahan pedagang India dan Asia Barat.',
        'Tarikh tapak-tapak ini masih dikaji. Kebanyakan bukti radiokarbon terkini menunjukkan kegiatan sekitar abad ke-2 hingga ke-10 Masihi di Sungai Batu, walaupun dakwaan tarikh yang jauh lebih awal pernah dibuat.',
      ],
      en: [
        'The Bujang Valley at the foot of Gunung Jerai holds dozens of temple (candi) and port sites associated with the kingdom of Old Kedah. It was a stopover for Indian and West Asian traders.',
        'Dating is still being researched. Most recent radiocarbon evidence points to activity at Sungai Batu around the 2nd to 10th centuries AD, although much earlier dates have been claimed.',
      ],
    },
    inGame: {
      ms: 'Sivik "Warisan Kedah Tua" membuka Candi Warisan yang menjana budaya.',
      en: 'The "Old Kedah Heritage" civic unlocks the Heritage Candi, which generates culture.',
    },
    sources: [
      { title: 'Bujang Valley (Wikipedia)', url: W('Bujang_Valley') },
      {
        title: 'Bujang Valley revised dating narrative (SEA Archaeology, 2023)',
        url: 'https://southeastasianarchaeology.com/2023/07/10/bujang-valley-revised-dating-narrative-towards-unesco-listing-of-ancient-maritime-site',
      },
    ],
    related: ['sungai_batu', 'era_entrepot'],
  }),
  E({
    id: 'sungai_batu',
    category: 'technology',
    period: 'c. 2nd – 10th century',
    title: { ms: 'Peleburan Besi Sungai Batu', en: 'Iron Smelting at Sungai Batu' },
    summary: {
      ms: 'Tapak peleburan besi, jeti dan struktur bata di Lembah Bujang.',
      en: 'Iron-smelting workshops, jetties and brick structures in the Bujang Valley.',
    },
    body: {
      ms: [
        'Ekskavasi di Sungai Batu menemui relau, sisa sanga besi, jeti dan struktur ritual dari bata. Jabatan Warisan Negara menyifatkannya sebagai pusat pengeluaran dan perdagangan besi sejak abad ke-2.',
        'Satu dakwaan awal meletakkan tarikh tapak ini pada abad ke-8 Sebelum Masihi, tetapi analisis Bayesian 2019 atas sampel radiokarbon menyokong julat abad ke-2 hingga ke-10 Masihi.',
      ],
      en: [
        'Excavations at Sungai Batu uncovered furnaces, iron slag, jetties and brick ritual structures. The National Heritage Department describes it as a centre of iron production and trade from the 2nd century.',
        'An early claim placed the site in the 8th century BC, but a 2019 Bayesian analysis of radiocarbon samples supports a 2nd to 10th century AD range.',
      ],
    },
    inGame: {
      ms: 'Teknologi "Peleburan Besi" membuka Relau Besi, yang menukar kayu kepada besi.',
      en: 'The "Iron Smelting" tech unlocks the Iron Smelter, which turns timber into iron.',
    },
    sources: [
      { title: 'Sungai Batu (Wikipedia)', url: W('Sungai_Batu') },
      { title: 'Jabatan Warisan Negara: Sungai Batu', url: 'https://www.heritage.gov.my/en/tapak-tapak-arkeologi-utama-di-malaysia/sungai-batu-merbok-kuala-muda-kedah.html' },
    ],
    related: ['lembah_bujang'],
  }),
  E({
    id: 'kesultanan_melaka',
    category: 'society',
    period: 'c. 1400 – 1511',
    title: { ms: 'Kesultanan Melaka', en: 'The Melaka Sultanate' },
    summary: {
      ms: 'Kerajaan maritim yang diasaskan sekitar 1400 oleh Parameswara.',
      en: 'A maritime kingdom founded around 1400 by Parameswara.',
    },
    body: {
      ms: [
        'Parameswara, seorang putera dari Sumatera, mengasaskan Melaka sekitar tahun 1400 (sesetengah sumber Portugis memberi 1411). Pengiktirafan Dinasti Ming pada 1405 membantu Melaka menghadapi tekanan jiran.',
        'Melaka berkembang menjadi entrepôt utama Asia Tenggara dan pusat penyebaran Islam. Ia ditawan Portugis pada 1511, dan keturunan sultannya kemudian mengasaskan Kesultanan Johor.',
      ],
      en: [
        'Parameswara, a Sumatran prince, founded Melaka around 1400 (some Portuguese sources give 1411). Recognition by the Ming court in 1405 helped Melaka withstand pressure from its neighbours.',
        'Melaka grew into Southeast Asia’s leading entrepôt and a centre for the spread of Islam. It was captured by the Portuguese in 1511, and the royal line went on to found the Johor Sultanate.',
      ],
    },
    inGame: {
      ms: 'Sivik "Kesultanan Melaka" membuka Istana Kesultanan, mercu tanda untuk mara ke Era 2.',
      en: 'The "Melaka Sultanate" civic unlocks the Sultanate Palace, the landmark needed to reach Era 2.',
    },
    sources: [
      { title: 'Malacca Sultanate (Wikipedia)', url: W('Malacca_Sultanate') },
      { title: 'Portuguese Malacca (Wikipedia)', url: W('Portuguese_Malacca') },
    ],
    related: ['zheng_he', 'syahbandar', 'undang_laut', 'melaka_1511', 'islam_melaka'],
  }),
  E({
    id: 'entrepot',
    category: 'trade',
    period: '15th century',
    title: { ms: 'Pelabuhan Entrepôt', en: 'The Entrepôt Port' },
    summary: {
      ms: 'Pelabuhan tempat barang diimport untuk dieksport semula, bukan dihasilkan sendiri.',
      en: 'A port where goods are imported to be re-exported rather than produced locally.',
    },
    body: {
      ms: [
        'Kekayaan Melaka datang daripada cukai pelabuhan dan perkhidmatan kepada pedagang: gudang, bekalan makanan, air dan keselamatan. Kain India ditukar dengan rempah Maluku dan barangan China.',
        'Kejayaan entrepôt bergantung pada keselamatan laluan laut, undang-undang yang adil dan layanan baik kepada pedagang asing.',
      ],
      en: [
        'Melaka’s wealth came from port duties and services to merchants: warehouses, food, water and security. Indian cloth was exchanged for Moluccan spices and Chinese goods.',
        'An entrepôt succeeds when its sea lanes are safe, its laws are fair and foreign merchants are treated well.',
      ],
    },
    inGame: {
      ms: 'Kapasiti eksport datang dari pelabuhan, gudang dan pejabat syahbandar. Barang mesti sampai ke pelabuhan melalui jalan atau sungai.',
      en: 'Export capacity comes from harbours, warehouses and harbour masters. Goods must reach the port by road or river.',
    },
    sources: [{ title: 'Entrepôt (Wikipedia)', url: W('Entrep%C3%B4t') }],
    related: ['syahbandar', 'monsun', 'kesultanan_melaka'],
  }),
  E({
    id: 'syahbandar',
    category: 'trade',
    period: '15th century',
    title: { ms: 'Syahbandar', en: 'The Shahbandar (Harbour Master)' },
    summary: {
      ms: 'Pegawai pelabuhan Melaka yang mengurus pedagang asing mengikut asal mereka.',
      en: 'Melaka’s port officials, each responsible for traders from particular regions.',
    },
    body: {
      ms: [
        'Melaka mempunyai empat syahbandar. Seorang khusus untuk pedagang Gujerat; yang lain mengurus pedagang dari India Selatan, Benggala dan Pasai, dari Kepulauan Melayu, serta dari China, Annam dan Ryukyu. Pembahagian tepat berbeza antara sumber.',
        'Syahbandar menempatkan pedagang, mengurus gudang dan memungut cukai.',
      ],
      en: [
        'Melaka had four shahbandars. One served Gujarati traders alone; the others handled traders from South India, Bengal and Pasai, from the Malay Archipelago, and from China, Annam and the Ryukyus. Sources differ on the exact grouping.',
        'The shahbandar housed merchants, managed warehouses and collected duties.',
      ],
    },
    inGame: {
      ms: 'Pejabat Syahbandar menambah kapasiti eksport dan menjadikan duta lebih berkesan.',
      en: 'The Harbour Master’s Office adds export capacity and makes envoys more effective.',
    },
    sources: [
      { title: 'Shahbandar (Britannica)', url: 'https://www.britannica.com/topic/shabunder' },
      { title: 'Shahbandar (Wikipedia)', url: W('Shahbandar') },
    ],
    related: ['entrepot', 'undang_laut'],
  }),
  E({
    id: 'undang_laut',
    category: 'society',
    period: '15th century',
    title: { ms: 'Undang-Undang Laut & Hukum Kanun Melaka', en: 'Melaka’s Maritime Laws & Legal Code' },
    summary: {
      ms: 'Kod undang-undang pelayaran dan kod undang-undang darat Kesultanan Melaka.',
      en: 'The Melaka Sultanate’s codes of maritime law and of land law.',
    },
    body: {
      ms: [
        'Undang-Undang Laut Melaka mengatur kuasa nakhoda, tatacara pelayaran dan perdagangan di kapal. Menurut manuskripnya, ia hasil mesyuarat para nakhoda pada zaman Sultan Muhammad Shah (1424–1444), walaupun tarikh penggubalannya tidak pasti.',
        'Hukum Kanun Melaka (Undang-Undang Melaka) ialah kod undang-undang am yang menggabungkan adat Melayu dan hukum Islam.',
      ],
      en: [
        'The Maritime Laws of Melaka set out the authority of ship captains (nakhoda), sailing procedure and shipboard trade. Its manuscript attributes it to a meeting of captains under Sultan Muhammad Shah (1424–1444), though the date of drafting is uncertain.',
        'The Hukum Kanun Melaka (Undang-Undang Melaka) is the general legal code, combining Malay custom (adat) and Islamic law.',
      ],
    },
    inGame: {
      ms: 'Sivik ini menaikkan harga eksport dan membuka dasar Pelabuhan Bebas dan Kedaulatan Undang-undang.',
      en: 'These civics raise export prices and unlock the Free Port and Rule of Law policies.',
    },
    sources: [
      { title: 'Undang-Undang Laut Melaka (Wikipedia)', url: W('Undang-Undang_Laut_Melaka') },
      { title: 'Undang-Undang Melaka (Wikipedia)', url: W('Undang-Undang_Melaka') },
    ],
    related: ['syahbandar', 'kesultanan_melaka'],
  }),
  E({
    id: 'monsun',
    category: 'trade',
    period: 'Recurring',
    title: { ms: 'Angin Monsun', en: 'The Monsoon Winds' },
    summary: {
      ms: 'Pusingan angin bermusim yang menentukan jadual pelayaran dan juga musim banjir.',
      en: 'Seasonal wind reversals that set sailing schedules and the flood season.',
    },
    body: {
      ms: [
        'Monsun barat daya (sekitar Mei hingga September) dan monsun timur laut (sekitar November hingga Mac) membawa kapal ke dan dari Selat Melaka. Pedagang menunggu di pelabuhan sehingga angin bertukar.',
        'Monsun timur laut juga membawa hujan lebat dan banjir ke kawasan rendah, terutamanya di pantai timur.',
      ],
      en: [
        'The south-west monsoon (roughly May to September) and north-east monsoon (roughly November to March) carried ships to and from the Straits of Melaka. Merchants waited in port until the winds turned.',
        'The north-east monsoon also brings heavy rain and floods to low-lying areas, especially on the east coast.',
      ],
    },
    inGame: {
      ms: 'Teknologi "Navigasi Angin Monsun" menambah kapasiti eksport. Banjir monsun boleh menjejaskan kawasan rendah tepi sungai pada hujung tahun.',
      en: 'The "Monsoon Navigation" tech adds export capacity. Monsoon floods can hit low riverside areas at the end of the year.',
    },
    sources: [{ title: 'Climate of Malaysia (Wikipedia)', url: W('Climate_of_Malaysia') }],
    related: ['entrepot'],
  }),
  E({
    id: 'zheng_he',
    category: 'event',
    period: '1405 – 1433',
    title: { ms: 'Pelayaran Laksamana Cheng Ho', en: 'The Voyages of Admiral Zheng He' },
    summary: {
      ms: 'Armada harta Dinasti Ming yang beberapa kali singgah di Melaka.',
      en: 'The Ming treasure fleets that called at Melaka several times.',
    },
    body: {
      ms: [
        'Antara 1405 dan 1433 armada Ming di bawah Laksamana Cheng Ho belayar ke Lautan Hindi. Melaka dijadikan pangkalan persinggahan dan gudang. Istana Ming mengiktiraf Melaka sekitar 1405.',
        'Tarikh lawatan pertama Cheng Ho ke Melaka berbeza mengikut sumber (1405, 1407 atau 1409). Parameswara sendiri melawat China pada 1411.',
      ],
      en: [
        'Between 1405 and 1433, Ming fleets under Admiral Zheng He sailed into the Indian Ocean. Melaka served as a stopover and depot. The Ming court recognised Melaka around 1405.',
        'Sources differ on when Zheng He first reached Melaka (1405, 1407 or 1409). Parameswara himself visited China in 1411.',
      ],
    },
    inGame: {
      ms: 'Peristiwa tahun 1409 meningkatkan hubungan dengan Dinasti Ming dan memberi ilmu.',
      en: 'An event in 1409 improves relations with Ming China and grants knowledge.',
    },
    sources: [
      { title: 'Diplomacy and commerce during the Ming treasure voyages (Wikipedia)', url: W('Diplomacy_and_commerce_during_the_Ming_treasure_voyages') },
      { title: 'Timeline of the Ming treasure voyages (Wikipedia)', url: W('Timeline_of_the_Ming_treasure_voyages') },
    ],
    related: ['kesultanan_melaka'],
  }),
  E({
    id: 'islam_melaka',
    category: 'society',
    period: '14th – 15th century',
    title: { ms: 'Islam di Alam Melayu', en: 'Islam in the Malay World' },
    summary: {
      ms: 'Pelabuhan dagang menjadi saluran penyebaran Islam di Nusantara.',
      en: 'Trading ports became channels for the spread of Islam across the archipelago.',
    },
    body: {
      ms: [
        'Batu Bersurat Terengganu, bertulisan Jawi, ialah antara bukti terawal Islam di Semenanjung; tarikhnya dipertikaikan antara 1303 dan 1387.',
        'Melaka menjadi pusat pengajian dan penyebaran Islam. Masjid tradisional di rantau ini lazimnya berbumbung piramid bertingkat, bukan berkubah.',
      ],
      en: [
        'The Terengganu Inscription Stone, written in Jawi, is among the earliest evidence of Islam in the peninsula; its date is disputed between 1303 and 1387.',
        'Melaka became a centre for Islamic learning and its spread. Traditional mosques in the region typically have tiered pyramidal roofs rather than domes.',
      ],
    },
    inGame: {
      ms: 'Masjid Bumbung Bertingkat memberi liputan perkhidmatan, budaya dan kesejahteraan.',
      en: 'The Tiered-Roof Mosque provides service coverage, culture and wellbeing.',
    },
    sources: [{ title: 'Terengganu Inscription Stone (Wikipedia)', url: W('Terengganu_Inscription_Stone') }],
    related: ['jawi', 'kesultanan_melaka'],
  }),
  E({
    id: 'jawi',
    category: 'society',
    period: '14th century onwards',
    title: { ms: 'Tulisan Jawi', en: 'Jawi Script' },
    summary: {
      ms: 'Abjad berasaskan huruf Arab untuk menulis bahasa Melayu.',
      en: 'An Arabic-based alphabet for writing Malay.',
    },
    body: {
      ms: [
        'Jawi menambah beberapa huruf kepada abjad Arab untuk bunyi Melayu. Ia digunakan dalam surat diraja, undang-undang, hikayat dan urusan perdagangan.',
        'Bahasa Melayu menjadi lingua franca perdagangan di pelabuhan Nusantara.',
      ],
      en: [
        'Jawi adds several letters to the Arabic alphabet for Malay sounds. It was used for royal letters, law codes, literature and trade.',
        'Malay became the lingua franca of commerce in the archipelago’s ports.',
      ],
    },
    inGame: { ms: 'Membuka Madrasah, sumber ilmu awal.', en: 'Unlocks the Madrasah, an early source of research.' },
    sources: [{ title: 'Jawi script (Wikipedia)', url: W('Jawi_script') }],
    related: ['islam_melaka'],
  }),
  E({
    id: 'melaka_1511',
    category: 'event',
    period: '1511',
    title: { ms: 'Kejatuhan Melaka (1511)', en: 'The Fall of Melaka (1511)' },
    summary: {
      ms: 'Portugis di bawah Afonso de Albuquerque menawan Melaka.',
      en: 'The Portuguese under Afonso de Albuquerque captured Melaka.',
    },
    body: {
      ms: [
        'Pada 1511 angkatan Portugis dari Goa menawan Melaka selepas pertempuran beberapa minggu. Sultan Mahmud Shah berundur dan keturunannya mengasaskan Kesultanan Johor.',
        'Ramai pedagang Muslim beralih ke pelabuhan lain seperti Johor, Aceh, Banten dan Brunei, mengubah peta perdagangan rantau.',
      ],
      en: [
        'In 1511 a Portuguese force from Goa captured Melaka after weeks of fighting. Sultan Mahmud Shah withdrew and his descendants founded the Johor Sultanate.',
        'Many Muslim merchants shifted to other ports such as Johor, Aceh, Banten and Brunei, reshaping the region’s trade map.',
      ],
    },
    inGame: {
      ms: 'Pedagang beralih ke pelabuhan anda buat sementara (kapasiti eksport +25%). Portugis muncul sebagai rakan dagang yang curiga.',
      en: 'Traders divert to your port for a time (+25% export capacity). The Portuguese appear as a wary trade partner.',
    },
    sources: [{ title: 'Capture of Malacca (1511) (Wikipedia)', url: W('Capture_of_Malacca_(1511)') }],
    related: ['kesultanan_melaka'],
  }),

  // ---------------------------------------------------------------- Era 2 topics
  E({
    id: 'perjanjian_1824',
    category: 'event',
    period: '1824 – 1826',
    title: { ms: 'Perjanjian Inggeris-Belanda 1824', en: 'The Anglo-Dutch Treaty of 1824' },
    summary: {
      ms: 'Membahagi Alam Melayu kepada lingkungan British dan Belanda.',
      en: 'Divided the Malay world into British and Dutch spheres.',
    },
    body: {
      ms: [
        'Perjanjian ini menyerahkan Melaka kepada British sebagai pertukaran dengan Bengkulu. Pulau Pinang, Melaka dan Singapura kemudian ditadbir bersama sebagai Negeri-Negeri Selat dari 1826.',
        'Garis pembahagian ini kelak mempengaruhi sempadan Malaysia dan Indonesia moden.',
      ],
      en: [
        'The treaty ceded Melaka to Britain in exchange for Bencoolen. Penang, Melaka and Singapore were then administered together as the Straits Settlements from 1826.',
        'The dividing line later shaped the borders of modern Malaysia and Indonesia.',
      ],
    },
    inGame: { ms: 'Menandakan permulaan Era 2 dan kemunculan rakan dagang baharu.', en: 'Marks the start of Era 2 and the arrival of new trade partners.' },
    sources: [
      { title: 'Anglo-Dutch Treaty of 1824 (Wikipedia)', url: W('Anglo-Dutch_Treaty_of_1824') },
      { title: 'Straits Settlements (Wikipedia)', url: W('Straits_Settlements') },
    ],
    related: ['era_timah', 'pangkor'],
  }),
  E({
    id: 'larut',
    category: 'economy',
    period: '1848 onwards',
    title: { ms: 'Bijih Timah Larut', en: 'The Larut Tin Fields' },
    summary: {
      ms: 'Penemuan bijih timah di Larut mencetuskan ledakan perlombongan.',
      en: 'Tin discoveries in Larut sparked a mining boom.',
    },
    body: {
      ms: [
        'Long Jaafar dikreditkan dengan penemuan bijih timah di Larut pada 1848 dan membawa pelombong Cina dari Pulau Pinang. Kisah gajahnya, Si Larut, pulang berlumpur bijih ialah lagenda popular. Orang Melayu sudah lama mendulang bijih aluvium sebelum itu.',
        'Kawasan lombong Klian Pauh kemudian menjadi bandar Taiping. Persaingan antara kongsi pelombong membawa kepada konflik yang mendorong campur tangan British.',
      ],
      en: [
        'Long Jaafar is credited with finding tin in Larut in 1848 and bringing in Chinese miners from Penang. The story of his elephant Si Larut returning caked in tin-bearing mud is a popular legend. Malays had panned alluvial tin long before.',
        'The Klian Pauh field later became the town of Taiping. Rivalry between mining kongsi led to conflicts that prompted British intervention.',
      ],
    },
    inGame: { ms: 'Bina lombong pada jubin bertimah (lapisan Sumber menunjukkan kekayaan bijih).', en: 'Build mines on tin tiles (the Resources overlay shows ore richness).' },
    sources: [
      { title: 'Long Jaafar (Wikipedia)', url: W('Long_Jaafar') },
      { title: 'Taiping, Perak (Wikipedia)', url: W('Taiping,_Perak') },
    ],
    related: ['timah', 'pangkor', 'kereta_api'],
  }),
  E({
    id: 'timah',
    category: 'economy',
    period: '15th century – 1985',
    title: { ms: 'Bijih Timah', en: 'Tin' },
    summary: {
      ms: 'Logam yang menjadi mata wang Melaka dan tunjang ekonomi kolonial.',
      en: 'The metal that served as Melaka’s currency and the backbone of the colonial economy.',
    },
    body: {
      ms: [
        'Bijih timah aluvium terkumpul di lembah kaki banjaran granit seperti Kinta dan Larut. Melaka menggunakan jongkong dan syiling timah sebagai mata wang.',
        'Kaedah perlombongan berkembang daripada mendulang kepada lombong dedah, pam hidraulik dan kapal korek. Tanah Melayu pernah menjadi pengeluar timah terbesar dunia.',
      ],
      en: [
        'Alluvial tin collects in valleys at the foot of granite ranges such as Kinta and Larut. Melaka used tin ingots and coins as currency.',
        'Mining methods evolved from panning (dulang) to open-cast pits, hydraulic pumps and dredges. Malaya was once the world’s largest tin producer.',
      ],
    },
    inGame: { ms: 'Jubin bertimah terletak di kaki bukit dan dataran berhampiran.', en: 'Tin tiles lie in the foothills and on the nearby valley floor.' },
    sources: [{ title: 'Tin mining in Malaysia (Wikipedia)', url: W('Tin_mining_in_Malaysia') }],
    related: ['larut', 'kapal_korek'],
  }),
  E({
    id: 'pangkor',
    category: 'society',
    period: '1874',
    title: { ms: 'Perjanjian Pangkor', en: 'The Pangkor Treaty' },
    summary: {
      ms: 'Perjanjian 20 Januari 1874 yang memperkenalkan Residen British di Perak.',
      en: 'The 20 January 1874 treaty that introduced a British Resident in Perak.',
    },
    body: {
      ms: [
        'Perjanjian ini ditandatangani di Pulau Pangkor ketika konflik perebutan takhta dan pergolakan di lombong Larut. Sultan dikehendaki menerima nasihat Residen dalam semua hal kecuali agama dan adat Melayu.',
        'Ia menjadi model Sistem Residen di negeri-negeri Melayu lain.',
      ],
      en: [
        'Signed on Pangkor island amid a succession dispute and unrest in the Larut mines, it required the Sultan to accept a Resident’s advice on all matters except Malay religion and custom.',
        'It became the model for the Residential System in other Malay states.',
      ],
    },
    inGame: { ms: 'Sivik "Sistem Residen" menambah cukai dan membuka Balai Polis.', en: 'The "Residential System" civic raises taxes and unlocks the Police Station.' },
    sources: [{ title: 'Pangkor Treaty of 1874 (Wikipedia)', url: W('Pangkor_Treaty_of_1874') }],
    related: ['nnmb', 'larut'],
  }),
  E({
    id: 'nnmb',
    category: 'society',
    period: '1896',
    title: { ms: 'Negeri-Negeri Melayu Bersekutu', en: 'The Federated Malay States' },
    summary: {
      ms: 'Perak, Selangor, Negeri Sembilan dan Pahang disatukan dari 1 Julai 1896.',
      en: 'Perak, Selangor, Negeri Sembilan and Pahang federated from 1 July 1896.',
    },
    body: {
      ms: [
        'Persekutuan ini memusatkan pentadbiran di Kuala Lumpur dan menyeragamkan perkhidmatan seperti kereta api dan kerja raya.',
        'Negeri lain seperti Johor menerima perlindungan British tetapi kekal di luar persekutuan.',
      ],
      en: [
        'The federation centralised administration in Kuala Lumpur and standardised services such as railways and public works.',
        'Other states such as Johor accepted British protection but stayed outside the federation.',
      ],
    },
    inGame: { ms: 'Menambah kapasiti eksport dan ilmu; diperlukan untuk Era 3.', en: 'Adds export capacity and research; required for Era 3.' },
    sources: [{ title: 'Federated Malay States (Wikipedia)', url: W('Federated_Malay_States') }],
    related: ['pangkor', 'kereta_api'],
  }),
  E({
    id: 'kereta_api',
    category: 'technology',
    period: '1885 onwards',
    title: { ms: 'Kereta Api Tanah Melayu', en: 'Railways of Malaya' },
    summary: {
      ms: 'Landasan pertama, Taiping–Port Weld, dibuka pada 1885 untuk mengangkut bijih timah.',
      en: 'The first line, Taiping–Port Weld, opened in 1885 to carry tin.',
    },
    body: {
      ms: [
        'Landasan sepanjang kira-kira 12 km itu menghubungkan lombong Larut dengan pelabuhan Port Weld (kini Kuala Sepetang). Kebanyakan sumber memberi tarikh pembukaan 1 Jun 1885.',
        'Rangkaian berkembang di bawah Keretapi Negeri-Negeri Melayu Bersekutu. Stesen Kuala Lumpur (1910), rekaan A. B. Hubback, terkenal dengan seni bina Indo-Saracenic.',
      ],
      en: [
        'The roughly 12 km line linked the Larut mines with the port of Port Weld (now Kuala Sepetang). Most sources give an opening date of 1 June 1885.',
        'The network grew under the Federated Malay States Railways. Kuala Lumpur station (1910), designed by A. B. Hubback, is known for its Indo-Saracenic architecture.',
      ],
    },
    inGame: {
      ms: 'Landasan kereta api ialah laluan logistik termurah di darat. Stesen menghubungkannya dengan jalan raya.',
      en: 'Rail is the cheapest land logistics route. Stations connect it to roads.',
    },
    sources: [
      { title: 'Taiping railway station (Wikipedia)', url: W('Taiping_railway_station') },
      { title: 'Malaysia: a railway story (NST, 2019)', url: 'https://www.nst.com.my/amp/property/2019/04/476532/malaysia-railway-story' },
    ],
    related: ['seni_bina_moorish', 'larut'],
  }),
  E({
    id: 'seni_bina_moorish',
    category: 'place',
    period: '1890s – 1920s',
    title: { ms: 'Seni Bina Indo-Saracenic', en: 'Indo-Saracenic Architecture' },
    summary: {
      ms: 'Gaya kolonial yang menggabungkan kubah, menara dan gerbang Mughal dan Moor.',
      en: 'A colonial style blending Mughal and Moorish domes, minarets and arches.',
    },
    body: {
      ms: [
        'Arkitek seperti A. C. Norman dan A. B. Hubback mereka bangunan awam di Kuala Lumpur dalam gaya ini, termasuk Stesen Kereta Api Kuala Lumpur (1910).',
        'Sumber berbeza sama ada menggelarnya Moorish, Mughal atau Indo-Saracenic.',
      ],
      en: [
        'Architects such as A. C. Norman and A. B. Hubback designed Kuala Lumpur’s public buildings in this style, including Kuala Lumpur Railway Station (1910).',
        'Sources differ on whether to call it Moorish, Mughal or Indo-Saracenic.',
      ],
    },
    inGame: { ms: 'Bangunan Stesen Besar Moorish ialah mercu tanda Era 2.', en: 'The Grand Moorish Station is the Era 2 landmark.' },
    sources: [{ title: 'Kuala Lumpur railway station (Wikipedia)', url: W('Kuala_Lumpur_railway_station') }],
    related: ['kereta_api'],
  }),
  E({
    id: 'getah',
    category: 'economy',
    period: '1877 onwards',
    title: { ms: 'Getah', en: 'Rubber' },
    summary: {
      ms: 'Pokok Hevea brasiliensis dari Brazil yang mengubah landskap Tanah Melayu.',
      en: 'Hevea brasiliensis from Brazil, which transformed Malaya’s landscape.',
    },
    body: {
      ms: [
        'Anak pokok getah tiba di Tanah Melayu pada 1877 melalui Kew dan Ceylon, dan Hugh Low, Residen Perak, menanamnya di Kuala Kangsar. H. N. Ridley kemudian memperkenalkan kaedah torehan yang tidak membunuh pokok dan giat mempromosikan getah, sehingga digelar "Mad Ridley". Sesetengah sumber tersilap mengaitkan penanaman 1877 kepada Ridley.',
        'Permintaan tayar kereta di Amerika mencetuskan ledakan getah awal abad ke-20; kemelesetan 1930-an menjatuhkan harga semula.',
      ],
      en: [
        'Rubber seedlings reached Malaya in 1877 via Kew and Ceylon, and Hugh Low, the Resident of Perak, planted them at Kuala Kangsar. H. N. Ridley later developed tapping methods that spared the tree and promoted rubber so eagerly that he was called "Mad Ridley". Some sources wrongly credit the 1877 planting to Ridley.',
        'Demand for car tyres in America drove an early 20th-century rubber boom; the Depression of the 1930s brought prices down again.',
      ],
    },
    inGame: { ms: 'Estet Getah menghasilkan getah; teknologi Torehan menambah hasil 40%.', en: 'Rubber Estates produce rubber; the tapping tech adds 40% output.' },
    sources: [
      { title: 'Henry Nicholas Ridley (Wikipedia)', url: W('Henry_Nicholas_Ridley') },
      { title: 'Brazil to Putrajaya: the tale of rubber (NST, 2022)', url: 'https://www.nst.com.my/amp/news/nation/2022/04/789619/brazil-putrajaya-tale-rubber' },
    ],
    related: ['masyarakat_majmuk', 'era_timah'],
  }),
  E({
    id: 'kapal_korek',
    category: 'technology',
    period: '1912 – 1980s',
    title: { ms: 'Kapal Korek Bijih', en: 'Tin Dredges' },
    summary: {
      ms: 'Kapal korek baldi raksasa yang terapung di kolam lombong.',
      en: 'Giant bucket dredges floating in mining ponds.',
    },
    body: {
      ms: [
        'Malayan Tin Dredging memasang kapal korek baldi pertama di Batu Gajah, Perak sekitar 1912; ia mula beroperasi dengan jayanya pada Januari 1913. Pada 1929 terdapat lebih 100 kapal korek beroperasi.',
        'Kapal Korek TT5 di Tanjung Tualang kini dipulihara sebagai muzium.',
      ],
      en: [
        'Malayan Tin Dredging installed the first bucket dredge at Batu Gajah, Perak, around 1912; it began operating successfully in January 1913. By 1929 more than 100 dredges were at work.',
        'Tin Dredge No. 5 (TT5) at Tanjung Tualang is now preserved as a museum.',
      ],
    },
    inGame: { ms: 'Kapal Korek menghasilkan bijih timah jauh lebih banyak daripada lombong dedah.', en: 'Dredges produce far more tin than open-cast mines.' },
    sources: [
      { title: 'Ipoh World: first dredge', url: 'https://db.ipohworld.org/view/id/1906' },
      { title: 'TT5 Dredge', url: 'https://tt5perak.com' },
    ],
    related: ['timah', 'larut'],
  }),
  E({
    id: 'masyarakat_majmuk',
    category: 'society',
    period: '19th – 20th century',
    title: { ms: 'Masyarakat Majmuk', en: 'A Plural Society' },
    summary: {
      ms: 'Penghijrahan untuk lombong dan estet membentuk masyarakat berbilang kaum.',
      en: 'Migration for mines and estates created a multi-ethnic society.',
    },
    body: {
      ms: [
        'Pekerja dari China kebanyakannya bekerja di lombong bijih dan perniagaan, manakala ramai pekerja dari India Selatan dibawa ke estet getah. Masyarakat Melayu dan Orang Asli kekal di kampung dan pertanian.',
        'Kepelbagaian ini membentuk budaya, makanan dan bandar Malaysia hingga kini, termasuk rumah kedai dengan "kaki lima".',
      ],
      en: [
        'Workers from China largely worked in tin mines and commerce, while many workers from South India were brought to rubber estates. Malay and Orang Asli communities remained in kampung and agriculture.',
        'This diversity shapes Malaysia’s culture, food and towns to this day, including shophouses with their covered "five-foot way".',
      ],
    },
    inGame: { ms: 'Sivik ini menambah pertumbuhan penduduk dan membuka dasar Imigrasi Terbuka.', en: 'This civic boosts population growth and unlocks the Open Migration policy.' },
    sources: [{ title: 'Demographics of Malaysia (Wikipedia)', url: W('Demographics_of_Malaysia') }],
    related: ['getah', 'larut'],
  }),

  // ---------------------------------------------------------------- Era 3 topics
  E({
    id: 'merdeka',
    category: 'event',
    period: '1955 – 1957',
    title: { ms: 'Merdeka', en: 'Merdeka (Independence)' },
    summary: {
      ms: 'Persekutuan Tanah Melayu mencapai kemerdekaan pada 31 Ogos 1957.',
      en: 'The Federation of Malaya gained independence on 31 August 1957.',
    },
    body: {
      ms: [
        'Pilihan raya persekutuan pertama pada 1955 membuka jalan kepada rundingan kemerdekaan. Pengisytiharan kemerdekaan dibacakan oleh Tunku Abdul Rahman di Stadium Merdeka dengan laungan "Merdeka!".',
        'Stadium itu dibina khusus untuk upacara tersebut dan kekal sebagai simbol kemerdekaan.',
      ],
      en: [
        'The first federal election in 1955 opened the way to independence negotiations. The proclamation was read by Tunku Abdul Rahman at Stadium Merdeka to cries of "Merdeka!".',
        'The stadium was built for the ceremony and remains a symbol of independence.',
      ],
    },
    inGame: { ms: 'Memasuki Era 3 memberikan sivik Kemerdekaan dan membuka Stadium Kemerdekaan.', en: 'Entering Era 3 grants the Independence civic and unlocks the Independence Stadium.' },
    sources: [
      { title: 'Malayan Declaration of Independence (Wikipedia)', url: W('Malayan_Declaration_of_Independence') },
      { title: 'Stadium Merdeka (Wikipedia)', url: W('Stadium_Merdeka') },
    ],
    related: ['malaysia_1963', 'era_merdeka'],
  }),
  E({
    id: 'malaysia_1963',
    category: 'event',
    period: '1963',
    title: { ms: 'Pembentukan Malaysia', en: 'The Formation of Malaysia' },
    summary: {
      ms: 'Malaysia dibentuk pada 16 September 1963.',
      en: 'Malaysia was formed on 16 September 1963.',
    },
    body: {
      ms: [
        'Persekutuan Tanah Melayu bergabung dengan Singapura, Sabah (Borneo Utara) dan Sarawak membentuk Malaysia. Singapura berpisah pada 1965.',
        'Tarikh 16 September disambut sebagai Hari Malaysia.',
      ],
      en: [
        'The Federation of Malaya joined Singapore, Sabah (North Borneo) and Sarawak to form Malaysia. Singapore separated in 1965.',
        '16 September is celebrated as Malaysia Day.',
      ],
    },
    inGame: { ms: 'Sivik ini menambah kesejahteraan dan pertumbuhan; diperlukan untuk Era 4.', en: 'This civic adds wellbeing and growth; required for Era 4.' },
    sources: [{ title: 'Malaysia Agreement (Wikipedia)', url: W('Malaysia_Agreement') }],
    related: ['merdeka', 'asean'],
  }),
  E({
    id: 'felda',
    category: 'economy',
    period: '1956 onwards',
    title: { ms: 'Tanah Rancangan Peneroka', en: 'Land Settlement Schemes' },
    summary: {
      ms: 'Lembaga kemajuan tanah persekutuan ditubuhkan pada 1 Julai 1956.',
      en: 'A federal land development authority was established on 1 July 1956.',
    },
    body: {
      ms: [
        'Peneroka diberi kira-kira 4 hingga 6 hektar tanah untuk menanam getah atau kelapa sawit, sebagai usaha membasmi kemiskinan luar bandar.',
        'Kelapa sawit makin diutamakan sejak 1960-an kerana pulangannya lebih cepat berbanding getah.',
      ],
      en: [
        'Settlers received about 4 to 6 hectares to plant rubber or oil palm, as part of efforts to reduce rural poverty.',
        'Oil palm became increasingly favoured from the 1960s because it paid back faster than rubber.',
      ],
    },
    inGame: { ms: 'Membuka Ladang Sawit Tanah Rancangan.', en: 'Unlocks the Land Scheme Oil Palm Estate.' },
    sources: [{ title: 'Federal Land Development Authority (Wikipedia)', url: W('Federal_Land_Development_Authority') }],
    related: ['era_merdeka', 'deb'],
  }),
  E({
    id: 'asean',
    category: 'trade',
    period: '1967',
    title: { ms: 'ASEAN', en: 'ASEAN' },
    summary: {
      ms: 'Persatuan Negara-Negara Asia Tenggara ditubuhkan melalui Deklarasi Bangkok 1967.',
      en: 'The Association of Southeast Asian Nations was founded by the 1967 Bangkok Declaration.',
    },
    body: {
      ms: [
        'Malaysia ialah salah satu daripada lima negara pengasas bersama Indonesia, Filipina, Singapura dan Thailand.',
        'ASEAN kemudian membina kawasan perdagangan bebas serantau.',
      ],
      en: [
        'Malaysia was one of the five founding members along with Indonesia, the Philippines, Singapore and Thailand.',
        'ASEAN later built a regional free trade area.',
      ],
    },
    inGame: { ms: 'Sivik ASEAN mempercepat kenaikan hubungan diplomatik.', en: 'The ASEAN civic speeds up diplomatic relation gains.' },
    sources: [{ title: 'ASEAN Declaration (Wikipedia)', url: W('ASEAN_Declaration') }],
    related: ['malaysia_1963'],
  }),
  E({
    id: 'deb',
    category: 'society',
    period: '1971 – 1990',
    title: { ms: 'Dasar Ekonomi Baru', en: 'The New Economic Policy' },
    summary: {
      ms: 'Dasar 1971 untuk membasmi kemiskinan dan menyusun semula masyarakat.',
      en: 'A 1971 policy to eradicate poverty and restructure society.',
    },
    body: {
      ms: [
        'DEB diperkenalkan melalui Rancangan Malaysia Kedua dengan dua matlamat serampang dua mata: membasmi kemiskinan tanpa mengira kaum dan menyusun semula masyarakat supaya kaum tidak dikenal pasti dengan fungsi ekonomi.',
        'Kesan dan pelaksanaannya terus menjadi bahan perbahasan.',
      ],
      en: [
        'Introduced through the Second Malaysia Plan, the NEP had two prongs: eradicating poverty regardless of race and restructuring society so that ethnicity was no longer identified with economic function.',
        'Its effects and implementation remain debated.',
      ],
    },
    inGame: { ms: 'Membuka dasar DEB: +kesejahteraan dan pertumbuhan, kos penyelenggaraan lebih tinggi.', en: 'Unlocks the NEP policy: +wellbeing and growth, higher upkeep.' },
    sources: [{ title: 'Malaysian New Economic Policy (Wikipedia)', url: W('Malaysian_New_Economic_Policy') }],
    related: ['felda', 'era_merdeka'],
  }),
  E({
    id: 'bayan_lepas',
    category: 'place',
    period: '1972',
    title: { ms: 'Zon Perindustrian Bebas Bayan Lepas', en: 'Bayan Lepas Free Industrial Zone' },
    summary: {
      ms: 'Zon perdagangan bebas pertama Malaysia, dibuka di Pulau Pinang pada 1972.',
      en: 'Malaysia’s first free trade zone, opened in Penang in 1972.',
    },
    body: {
      ms: [
        'Diilhamkan oleh Ketua Menteri Lim Chong Eu dan dimungkinkan oleh Akta Zon Perdagangan Bebas 1971, zon ini menarik pengeluar semikonduktor antarabangsa. Intel membuka kilang luar negara pertamanya di sini.',
        'Pulau Pinang kemudian berkembang menjadi hab elektronik utama Asia Tenggara.',
      ],
      en: [
        'Championed by Chief Minister Lim Chong Eu and enabled by the Free Trade Zones Act 1971, the zone drew international semiconductor makers. Intel opened its first offshore plant here.',
        'Penang went on to become a leading electronics hub in Southeast Asia.',
      ],
    },
    inGame: { ms: 'Zon Perdagangan Bebas menghasilkan elektronik dan menarik tawaran pelaburan.', en: 'Free Trade Zones produce electronics and attract investment offers.' },
    sources: [{ title: 'Bayan Lepas Free Industrial Zone (Wikipedia)', url: W('Bayan_Lepas_Free_Industrial_Zone') }],
    related: ['era_merdeka', 'pandang_timur'],
  }),
  E({
    id: 'pandang_timur',
    category: 'society',
    period: '1982',
    title: { ms: 'Dasar Pandang ke Timur', en: 'The Look East Policy' },
    summary: {
      ms: 'Diumumkan pada 8 Februari 1982 untuk mencontohi Jepun dan Korea Selatan.',
      en: 'Announced on 8 February 1982 to learn from Japan and South Korea.',
    },
    body: {
      ms: [
        'Dasar ini menggalakkan etika kerja, disiplin dan amalan pengurusan Asia Timur. Ribuan pelajar dan pekerja dihantar berlatih di Jepun dan Korea.',
        'Penilaian tentang kejayaannya berbeza-beza.',
      ],
      en: [
        'The policy promoted East Asian work ethics, discipline and management practices. Thousands of students and workers trained in Japan and Korea.',
        'Assessments of its success vary.',
      ],
    },
    inGame: { ms: 'Dasar Pandang ke Timur menambah ilmu serta pengeluaran barangan dan elektronik.', en: 'The Look East policy adds research and goods/electronics output.' },
    sources: [{ title: 'Look East policy (Malaysia) (Wikipedia)', url: W('Look_East_policy_(Malaysia)') }],
    related: ['kereta_nasional', 'bayan_lepas'],
  }),
  E({
    id: 'kereta_nasional',
    category: 'technology',
    period: '1983 – 1985',
    title: { ms: 'Kereta Nasional', en: 'The National Car' },
    summary: {
      ms: 'Syarikat kereta nasional diasaskan pada 1983; kereta pertamanya keluar kilang pada 9 Julai 1985.',
      en: 'The national car company was founded in 1983; its first car rolled off the line on 9 July 1985.',
    },
    body: {
      ms: [
        'Projek usaha sama dengan Mitsubishi ini membina kilang di Shah Alam. Nama kereta pertama dipilih melalui pertandingan nasional.',
        'Sumber berbeza tentang tarikh pelancaran awam (Julai atau September 1985).',
      ],
      en: [
        'A joint venture with Mitsubishi built the plant at Shah Alam. The first car’s name was chosen through a national contest.',
        'Sources differ on the public launch date (July or September 1985).',
      ],
    },
    inGame: { ms: 'Kilang Kereta Nasional menukar besi dan getah kepada barangan bernilai tinggi.', en: 'The National Car Plant turns iron and rubber into high-value goods.' },
    sources: [{ title: 'Proton Saga (first generation) (Wikipedia)', url: W('Proton_Saga_(first_generation)') }],
    related: ['pandang_timur', 'era_merdeka'],
  }),

  // ---------------------------------------------------------------- Era 4 topics
  E({
    id: 'msc',
    category: 'technology',
    period: '1996',
    title: { ms: 'Koridor Raya Multimedia (MSC)', en: 'The Multimedia Super Corridor (MSC)' },
    summary: {
      ms: 'Zon ekonomi khas teknologi tinggi yang dilancarkan pada 1996.',
      en: 'A high-tech special economic zone launched in 1996.',
    },
    body: {
      ms: [
        'MSC merangkumi kawasan dari Kuala Lumpur ke lapangan terbang antarabangsa baharu, termasuk Cyberjaya dan Putrajaya. Ia menawarkan insentif kepada syarikat teknologi maklumat.',
        'Kini dikenali sebagai MSC Malaysia, ia menjadi asas ekonomi digital negara.',
      ],
      en: [
        'The MSC stretched from Kuala Lumpur to the new international airport and included Cyberjaya and Putrajaya, offering incentives to IT companies.',
        'Now called MSC Malaysia, it laid the foundation for the country’s digital economy.',
      ],
    },
    inGame: { ms: 'Memasuki Era 4 memberi ilmu tambahan; teknologi MSC membuka Hab Inovasi.', en: 'Entering Era 4 grants bonus research; the MSC tech unlocks the Innovation Hub.' },
    sources: [{ title: 'MSC Malaysia (Wikipedia)', url: W('MSC_Malaysia') }],
    related: ['era_digital', 'mydigital'],
  }),
  E({
    id: 'klia',
    category: 'place',
    period: '1998',
    title: { ms: 'Lapangan Terbang Antarabangsa Baharu', en: 'The New International Airport' },
    summary: {
      ms: 'Lapangan terbang antarabangsa utama di Sepang dibuka pada Jun 1998.',
      en: 'The main international airport at Sepang opened in June 1998.',
    },
    body: {
      ms: [
        'Bangunan terminalnya terkenal dengan bumbung modul berbentuk payung yang diilhamkan konsep "lapangan terbang dalam hutan, hutan dalam lapangan terbang".',
        'Ia menjadi hab kargo udara untuk barangan elektronik bernilai tinggi.',
      ],
      en: [
        'Its terminal is known for modular umbrella-like roofs inspired by the idea of "an airport in the forest, a forest in the airport".',
        'It became an air-cargo hub for high-value electronics.',
      ],
    },
    inGame: { ms: 'Lapangan Terbang Antarabangsa memberi kapasiti eksport yang sangat besar.', en: 'The International Airport provides very large export capacity.' },
    sources: [{ title: 'Kuala Lumpur International Airport (Wikipedia)', url: W('Kuala_Lumpur_International_Airport') }],
    related: ['msc'],
  }),
  E({
    id: 'mrt',
    category: 'technology',
    period: '2016 – 2017',
    title: { ms: 'Transit Aliran Massa (MRT)', en: 'Mass Rapid Transit (MRT)' },
    summary: {
      ms: 'Laluan MRT Sungai Buloh–Kajang beroperasi sepenuhnya pada 17 Julai 2017.',
      en: 'The Sungai Buloh–Kajang MRT line became fully operational on 17 July 2017.',
    },
    body: {
      ms: [
        'Fasa pertama (Sungai Buloh–Semantan) dibuka pada Disember 2016 dan fasa kedua pada Julai 2017. Panjang laluan dilaporkan sekitar 46–51 km bergantung kepada sumber.',
        'MRT mengurangkan kesesakan dan meningkatkan nilai tanah di sekitar stesen.',
      ],
      en: [
        'Phase one (Sungai Buloh–Semantan) opened in December 2016 and phase two in July 2017. The line’s length is reported as roughly 46–51 km depending on the source.',
        'The MRT eases congestion and raises land values around its stations.',
      ],
    },
    inGame: { ms: 'Landasan MRT ialah laluan logistik terpantas; stesen MRT menambah kesejahteraan.', en: 'MRT lines are the fastest logistics links; MRT stations add wellbeing.' },
    sources: [{ title: 'Sg Buloh-Kajang MRT fully operational (The Star, 2017)', url: 'https://www.thestar.com.my/news/nation/2017/06/08/sg-buloh-kajang-mrt-fully-operational-by-july-17' }],
    related: ['era_digital'],
  }),
  E({
    id: 'mydigital',
    category: 'economy',
    period: '2021',
    title: { ms: 'MyDIGITAL', en: 'MyDIGITAL' },
    summary: {
      ms: 'Rangka Tindakan Ekonomi Digital Malaysia dilancarkan pada 19 Februari 2021.',
      en: 'The Malaysia Digital Economy Blueprint was launched on 19 February 2021.',
    },
    body: {
      ms: [
        'Rangka tindakan ini dilaksanakan dalam tiga fasa hingga 2030 dan menyasarkan sumbangan ekonomi digital sebanyak 22.6% kepada KDNK serta 500,000 peluang pekerjaan.',
        'Ia melengkapi Rancangan Malaysia Kedua Belas dan Wawasan Kemakmuran Bersama 2030.',
      ],
      en: [
        'It runs in three phases to 2030 and targets a digital economy share of 22.6% of GDP and 500,000 new jobs.',
        'It complements the Twelfth Malaysia Plan and the Shared Prosperity Vision 2030.',
      ],
    },
    inGame: { ms: 'Sivik MyDIGITAL menambah pengeluaran perkhidmatan digital 25%.', en: 'The MyDIGITAL civic boosts digital services output by 25%.' },
    sources: [{ title: 'PM launches MyDigital (NST, 2021)', url: 'https://www.nst.com.my/amp/news/nation/2021/02/666982/pm-launches-mydigital-malaysias-digital-economy-blueprint' }],
    related: ['msc', 'era_digital'],
  }),
  E({
    id: 'menara_berkembar',
    category: 'place',
    period: '1998 – 1999',
    title: { ms: 'Menara Berkembar', en: 'The Twin Towers' },
    summary: {
      ms: 'Pencakar langit berkembar Kuala Lumpur ialah bangunan tertinggi dunia dari 1998 hingga 2004.',
      en: 'Kuala Lumpur’s twin skyscrapers were the world’s tallest buildings from 1998 to 2004.',
    },
    body: {
      ms: [
        'Pelannya berasaskan bintang lapan bucu, motif geometri Islam, dan kedua-dua menara dihubungkan oleh jambatan langit. Strukturnya siap pada 1998 dan dirasmikan pada Ogos 1999.',
        'Mercu tanda dalam permainan ini diilhamkan oleh menara tersebut tetapi merupakan reka bentuk asli.',
      ],
      en: [
        'Its floor plan is based on an eight-pointed star, an Islamic geometric motif, and the towers are linked by a skybridge. The structure was completed in 1998 and officially opened in August 1999.',
        'The landmark in this game is inspired by those towers but is an original design.',
      ],
    },
    inGame: {
      ms: 'Bina Menara Berkembar, capai 30,000 penduduk dan selesaikan Sistem Bandar Pintar dan Negara Maju untuk menang.',
      en: 'Build the Twin Towers, reach 30,000 residents and complete Smart City Systems and Developed Nation to win.',
    },
    sources: [{ title: 'Petronas Twin Towers (Britannica)', url: 'https://www.britannica.com/topic/Petronas-Twin-Towers' }],
    related: ['era_digital'],
  }),
  E({
    id: 'padi',
    category: 'economy',
    period: 'All eras',
    title: { ms: 'Padi & Sawah', en: 'Rice & Paddy Fields' },
    summary: {
      ms: 'Makanan ruji yang ditanam di dataran aluvium yang subur.',
      en: 'The staple food, grown on fertile alluvial plains.',
    },
    body: {
      ms: [
        'Sawah memerlukan tanah rata, air dan sistem pengairan. Dataran sungai menyediakan tanah aluvium yang paling subur.',
        'Pelabuhan dagang juga mengimport beras dari Jawa dan Siam apabila hasil tempatan tidak mencukupi.',
      ],
      en: [
        'Paddy needs flat land, water and irrigation. River plains provide the most fertile alluvial soil.',
        'Trading ports also imported rice from Java and Siam when local harvests fell short.',
      ],
    },
    inGame: {
      ms: 'Sawah mesti dibina di tanah subur. Jika makanan tidak cukup, beras diimport melalui pelabuhan pada harga tinggi.',
      en: 'Paddy fields need fertile soil. If food runs short, rice is imported through the port at a high price.',
    },
    sources: [{ title: 'Rice production in Malaysia (Wikipedia)', url: W('Rice_production_in_Malaysia') }],
    related: ['entrepot'],
  }),
  E({
    id: 'pasar',
    category: 'trade',
    period: 'All eras',
    title: { ms: 'Pasar', en: 'The Pasar (Market)' },
    summary: {
      ms: 'Pusat jual beli tempatan, daripada pasar pagi hingga pasar malam.',
      en: 'The local market, from morning markets to night markets.',
    },
    body: {
      ms: [
        'Pasar menghubungkan petani, nelayan dan pedagang. Ia menjadi tempat pertemuan sosial dan pertukaran budaya.',
        'Dalam bandar dagang, pasar sering terletak berhampiran sungai dan jeti.',
      ],
      en: [
        'Markets connect farmers, fishers and traders, and are places of social gathering and cultural exchange.',
        'In trading towns, markets were often located near rivers and jetties.',
      ],
    },
    inGame: { ms: 'Pasar ialah hab logistik tempatan dan memberi liputan rekreasi.', en: 'The Pasar is a local logistics hub and provides leisure coverage.' },
    sources: [{ title: 'Pasar malam (Wikipedia)', url: W('Pasar_malam') }],
    related: ['entrepot'],
  }),
];

export const ENTRY_MAP: Record<string, Entry> = Object.fromEntries(ENTRIES.map((e) => [e.id, e]));
