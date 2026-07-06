import React, { createContext, useContext, useState, useEffect } from 'react';

// ===========================================
// SVAKS Internationalization (i18n)
// Supports: English (en), Hindi (hi)
// ===========================================

const translations = {
  en: {
    // Navigation
    'nav.home': 'Home',
    'nav.about': 'About',
    'nav.committee': 'Committee',
    'nav.notifications': 'Notifications',
    'nav.gallery': 'Gallery',
    'nav.adminPanel': 'Admin Panel',

    // Hero
    'hero.subtitle': 'YADGIR • KARNATAKA',
    'hero.description': '"Our society is built on the foundation of unity, dharma and brotherhood. Through collective organization, cooperation and welfare, we build a strong community."',
    'hero.learnMore': 'Learn More',
    'hero.viewStats': 'View Stats',

    // Stats
    'stats.title': 'SAMAJ STATISTICS',
    'stats.heading': 'Samaj Overview',
    'stats.totalFamilies': 'Total Families',

    // Notice Board
    'notice.title': 'Notice Board',
    'notice.empty': 'No notices to display',
    'notice.share': 'Share on WhatsApp',

    // About
    'about.label': 'ABOUT US',
    'about.heading': 'Samaj Mission',
    'about.subheading': 'Our main objectives and values',
    'about.dharma.title': 'Dharma & Culture',
    'about.dharma.desc': 'Protection of ancient Sanatan Dharma, preservation of cultural traditions and passing them to future generations.',
    'about.support.title': 'Collective Support',
    'about.support.desc': "Every member's monthly contribution helps in samaj development and helping needy members. Unity is strength.",
    'about.education.title': 'Education & Knowledge',
    'about.education.desc': 'Promoting education for samaj children, identifying talent and helping them succeed in life.',
    'about.organization.title': 'Samaj Organization',
    'about.organization.desc': 'Managing samaj with unity and transparency, organizing annual meetings and cultural programs.',
    'about.service.title': 'Service & Sacrifice',
    'about.service.desc': 'Support for elderly and children, help during illness, and volunteers contribution in social programs.',
    'about.festivals.title': 'Festivals & Celebrations',
    'about.festivals.desc': 'Celebrating Navratri, Diwali, Holi and other religious festivals collectively, organizing community programs.',

    // Committee
    'committee.label': 'OUR TEAM',
    'committee.heading': 'Samaj Committee',
    'committee.subheading': 'Meet the people who lead our samaj',
    'committee.addPhone': 'Add phone via admin',

    // Gallery
    'gallery.label': 'GALLERY',
    'gallery.heading': 'Samaj Events Gallery',
    'gallery.subheading': 'Photos from our community celebrations and programs',
    'gallery.empty': 'No event photos yet. Add photos from Admin panel!',
    'gallery.viewAll': 'View All Albums',

    // Info
    'info.temple.title': 'Temple & Puja',
    'info.temple.desc': 'Collective puja programs and festival arrangements',
    'info.matrimony.title': 'Matrimony',
    'info.matrimony.desc': 'Finding suitable match for sons and daughters',
    'info.education.title': 'Education Aid',
    'info.education.desc': 'Scholarships for economically weaker students',
    'info.medical.title': 'Medical Help',
    'info.medical.desc': 'Assistance for treatment of poor patients',

    // Footer
    'footer.mantra': 'ॐ Sarve Bhavantu Sukhinah • Sarve Santu Niramayah',

    // Offline banner
    'offline.message': 'You are offline. Changes will be saved locally.',

    // Admin
    'admin.loading': 'Loading cloud data...',
    'admin.refreshCloud': '🔄 Refresh from Cloud',
    'admin.logout': 'Logout',
    'admin.logoutIcon': '🔒',
    'admin.dashboard.title': 'Dashboard',
    'admin.members.title': 'Members',
    'admin.collections.title': 'Collections',
    'admin.expenditure.title': 'Expenditure',
    'admin.notices.title': 'Notices',
    'admin.gallery.title': 'Gallery',
    'admin.reports.title': 'Reports',
    'admin.committee.title': 'Committee',
    'admin.settings.title': 'Settings',
    'admin.markAllPaid': 'Mark All Paid',
    'admin.remainder.whatsapp': 'WhatsApp',
    'admin.remainder.sms': 'SMS',
    'admin.printReceipt': '🧾 Receipt',
    'admin.totalMembers': 'Total Members',
    'admin.totalCollections': 'Total Collections',
    'admin.totalExpense': 'Total Expense',
    'admin.balance': 'Balance',

    // Reminder messages
    'reminder.whatsapp.title': 'WhatsApp Reminder',
    'reminder.sms.title': 'SMS Reminder',
    'reminder.message': 'Namaste {name} ji, aapka {month} {year} ka monthly samaj contribution ({amount}) abhi tak pending hai. Kripya jaldi se jama karein. - SVAKS Yadgir',
    'reminder.shared': 'Reminder sent!',
    'reminder.noPhone': 'No phone number for this member'
  },

  hi: {
    // Navigation
    'nav.home': 'मुख्य पृष्ठ',
    'nav.about': 'हमारे बारे में',
    'nav.committee': 'समिति',
    'nav.notifications': 'सूचनाएं',
    'nav.gallery': 'गैलरी',
    'nav.adminPanel': 'एडमिन पैनल',

    // Hero
    'hero.subtitle': 'यादगीर • कर्नाटक',
    'hero.description': '"हमारा समाज एकता, धर्म और भाईचारे की नींव पर खड़ा है। सामूहिक संगठन, सहयोग और कल्याण के माध्यम से हम एक मजबूत समुदाय का निर्माण करते हैं।"',
    'hero.learnMore': 'और जानें',
    'hero.viewStats': 'आँकड़े देखें',

    // Stats
    'stats.title': 'समाज आँकड़े',
    'stats.heading': 'समाज अवलोकन',
    'stats.totalFamilies': 'कुल परिवार',

    // Notice Board
    'notice.title': 'सूचना पट्ट',
    'notice.empty': 'कोई सूचना नहीं है',
    'notice.share': 'WhatsApp पर शेयर करें',

    // About
    'about.label': 'हमारे बारे में',
    'about.heading': 'समाज का उद्देश्य',
    'about.subheading': 'हमारे मुख्य उद्देश्य और मूल्य',
    'about.dharma.title': 'धर्म और संस्कृति',
    'about.dharma.desc': 'प्राचीन सनातन धर्म का संरक्षण, सांस्कृतिक परंपराओं की रक्षा और उन्हें भावी पीढ़ी तक पहुँचाना।',
    'about.support.title': 'सामूहिक सहयोग',
    'about.support.desc': 'हर सदस्य का मासिक योगदान समाज के विकास और जरूरतमंद सदस्यों की मदद में लगता है। एकता में बल है।',
    'about.education.title': 'शिक्षा और ज्ञान',
    'about.education.desc': 'समाज के बच्चों के लिए शिक्षा को बढ़ावा देना, प्रतिभा की पहचान करना और उन्हें जीवन में सफल होने में मदद करना।',
    'about.organization.title': 'समाज संगठन',
    'about.organization.desc': 'एकता और पारदर्शिता के साथ समाज का संचालन, वार्षिक बैठकों और सांस्कृतिक कार्यक्रमों का आयोजन।',
    'about.service.title': 'सेवा और त्याग',
    'about.service.desc': 'बुजुर्गों और बच्चों के लिए सहयोग, बीमारी के समय मदद, और सामाजिक कार्यक्रमों में स्वयंसेवकों का योगदान।',
    'about.festivals.title': 'त्योहार और उत्सव',
    'about.festivals.desc': 'नवरात्रि, दिवाली, होली और अन्य धार्मिक त्योहार सामूहिक रूप से मनाना, सामुदायिक कार्यक्रमों का आयोजन।',

    // Committee
    'committee.label': 'हमारी टीम',
    'committee.heading': 'समाज समिति',
    'committee.subheading': 'हमारे समाज का नेतृत्व करने वाले लोग',
    'committee.addPhone': 'एडमिन से फ़ोन जोड़ें',

    // Gallery
    'gallery.label': 'गैलरी',
    'gallery.heading': 'समाज कार्यक्रम गैलरी',
    'gallery.subheading': 'हमारे सामुदायिक उत्सवों और कार्यक्रमों की तस्वीरें',
    'gallery.empty': 'अभी कोई तस्वीरें नहीं हैं। एडमिन पैनल से जोड़ें!',
    'gallery.viewAll': 'सभी एल्बम देखें',

    // Info
    'info.temple.title': 'मंदिर और पूजा',
    'info.temple.desc': 'सामूहिक पूजा कार्यक्रम और त्योहार व्यवस्था',
    'info.matrimony.title': 'विवाह',
    'info.matrimony.desc': 'बेटों और बेटियों के लिए उपयुक्त जीवनसाथी खोजना',
    'info.education.title': 'शिक्षा सहायता',
    'info.education.desc': 'आर्थिक रूप से कमजोर छात्रों के लिए छात्रवृत्ति',
    'info.medical.title': 'चिकित्सा सहायता',
    'info.medical.desc': 'गरीब मरीजों के इलाज में सहायता',

    // Footer
    'footer.mantra': 'ॐ सर्वे भवन्तु सुखिनः • सर्वे सन्तु निरामयाः',

    // Offline banner
    'offline.message': 'आप ऑफ़लाइन हैं। परिवर्तन स्थानीय रूप से सहेजे जाएंगे।',

    // Admin
    'admin.loading': 'क्लाउड डेटा लोड हो रहा है...',
    'admin.refreshCloud': '🔄 क्लाउड से रिफ्रेश करें',
    'admin.logout': 'लॉगआउट',
    'admin.logoutIcon': '🔒',
    'admin.dashboard.title': 'डैशबोर्ड',
    'admin.members.title': 'सदस्य',
    'admin.collections.title': 'संग्रह',
    'admin.expenditure.title': 'व्यय',
    'admin.notices.title': 'सूचनाएं',
    'admin.gallery.title': 'गैलरी',
    'admin.reports.title': 'रिपोर्ट',
    'admin.committee.title': 'समिति',
    'admin.settings.title': 'सेटिंग्स',
    'admin.markAllPaid': 'सभी को भुगतान किए चिह्नित करें',
    'admin.remainder.whatsapp': 'व्हाट्सएप',
    'admin.remainder.sms': 'एसएमएस',
    'admin.printReceipt': '🧾 रसीद',
    'admin.totalMembers': 'कुल सदस्य',
    'admin.totalCollections': 'कुल संग्रह',
    'admin.totalExpense': 'कुल व्यय',
    'admin.balance': 'शेष',

    // Reminder messages
    'reminder.whatsapp.title': 'व्हाट्सएप रिमाइंडर',
    'reminder.sms.title': 'एसएमएस रिमाइंडर',
    'reminder.message': 'नमस्ते {name} जी, आपका {month} {year} का मासिक समाज योगदान ({amount}) अभी तक लंबित है। कृपया जल्दी जमा करें। - SVAKS यादगीर',
    'reminder.shared': 'रिमाइंडर भेजा गया!',
    'reminder.noPhone': 'इस सदस्य का फ़ोन नंबर नहीं है'
  }
};

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem('svaks_lang') || 'en';
    } catch {
      return 'en';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('svaks_lang', lang);
    } catch {}
    // Also set on <html> for CSS-based theming/typography hooks
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', lang);
    }
  }, [lang]);

  const t = (key, params = {}) => {
    let str = (translations[lang] && translations[lang][key]) || translations.en[key] || key;
    // Use replaceAll (no regex compilation needed) — faster and safer
    if (params && typeof str === 'string') {
      Object.keys(params).forEach(p => {
        str = str.split(`{${p}}`).join(String(params[p]));
      });
    }
    return str;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, available: ['en', 'hi'] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used inside LanguageProvider');
  return ctx;
}

export default LanguageContext;
