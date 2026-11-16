INSERT OR REPLACE INTO schema_meta (key, value) VALUES
  ('schema_version', '1'),
  ('seed_version', '1'),
  ('content_status', 'fictional-scenario-not-live-intelligence');

INSERT OR REPLACE INTO scenarios (id, title_ar, date_label_ar, description_ar, disclaimer_ar, is_active) VALUES
  ('sandbox-2026', 'ممرات السودان: سيناريو التفاوض', 'نوفمبر 2026', 'سيناريو تعليمي خيالي عن إدارة التوترات المحلية عبر التفاوض والخدمات والشرعية المدنية.', 'كل الجهات والتأثيرات هنا خيالية لأغراض اللعب، ولا تمثل جهات حقيقية أو خريطة سيطرة أو معلومات ميدانية حالية.', 1);

INSERT OR REPLACE INTO states (id, name_ar, region_ar, scenario_note_ar) VALUES
  ('khartoum', 'الخرطوم', 'الوسط', 'مركز إداري وإعلامي؛ القرارات فيه تؤثر على الشرعية العامة في السيناريو.'),
  ('gezira', 'الجزيرة', 'الوسط', 'ولاية زراعية في السيناريو؛ الخدمات وسلاسل الإمداد عنصران حاسمان.'),
  ('white-nile', 'النيل الأبيض', 'الوسط', 'مساحة عبور وخدمات؛ نجاح الوساطة يقلل الاحتكاك بين المجتمعات.'),
  ('blue-nile', 'النيل الأزرق', 'الشرق الأوسط', 'تنوع مجتمعي مرتفع؛ الحوار المحلي يزيد نقاط الثقة.'),
  ('sennar', 'سنار', 'الشرق الأوسط', 'ولاية تربط بين مراكز سكانية؛ الأولوية للاستقرار والخدمات.'),
  ('gedaref', 'القضارف', 'الشرق', 'سيناريو حدودي داخلي؛ التعاون الاقتصادي يخفض التوتر.'),
  ('kassala', 'كسلا', 'الشرق', 'شبكات اجتماعية متنوعة؛ الحلول التشاركية تمنح نقاط شرعية.'),
  ('red-sea', 'البحر الأحمر', 'الشرق', 'ولاية ساحلية في الخيال؛ إدارة الموارد العامة هي محور القرار.'),
  ('river-nile', 'نهر النيل', 'الشمال', 'مجتمعات متباعدة؛ التواصل والخدمات يحددان سرعة الاستجابة.'),
  ('northern', 'الشمالية', 'الشمال', 'ولاية واسعة؛ التخطيط المتدرج أفضل من القرارات المفاجئة.'),
  ('north-kordofan', 'شمال كردفان', 'كردفان', 'حلقة وصل داخلية؛ التفاوض على الخدمات يرفع الاستقرار.'),
  ('south-kordofan', 'جنوب كردفان', 'كردفان', 'تعدد محلي واضح؛ الاعتراف بالمطالب وفتح الحوار يرفع الثقة.'),
  ('west-kordofan', 'غرب كردفان', 'كردفان', 'التوازن بين الخدمات والموارد هو تحدي الجولة.'),
  ('north-darfur', 'شمال دارفور', 'دارفور', 'مساحة واسعة؛ الأولوية في السيناريو لحماية الخدمات المدنية.'),
  ('south-darfur', 'جنوب دارفور', 'دارفور', 'كثافة سكانية متنوعة؛ التهدئة المجتمعية تمنح أثرًا مضاعفًا.'),
  ('east-darfur', 'شرق دارفور', 'دارفور', 'نجاح الشراكات المحلية يرفع قابلية تنفيذ الاتفاقات.'),
  ('west-darfur', 'غرب دارفور', 'دارفور', 'الوساطة المجتمعية هي المسار الأفضل في هذا السيناريو.'),
  ('central-darfur', 'وسط دارفور', 'دارفور', 'القرارات المتدرجة تقلل المخاطر وتزيد فرص التوافق.');

INSERT OR REPLACE INTO factions (id, name_ar, type_ar, description_ar, objectives_ar, color, is_fictional) VALUES
  ('civic-coalition', 'الائتلاف المدني الوطني', 'مدني', 'جهة خيالية تركز على الخدمات والتمثيل المحلي والحوار المفتوح.', 'رفع الشرعية المدنية وتحسين الخدمات الأساسية.', '#c6a76a', 1),
  ('regional-council', 'المجلس الإقليمي التفاوضي', 'إقليمي', 'جهة خيالية تطالب بصلاحيات محلية أوسع عبر مسار تفاوضي سلمي.', 'توسيع الإدارة المحلية مع الحفاظ على قنوات التفاوض.', '#78b7a0', 1),
  ('community-network', 'شبكة المجتمعات المحلية', 'مجتمعي', 'شبكة خيالية من لجان محلية تعمل على الوساطة والخدمات.', 'حماية الثقة المجتمعية ومنع اتساع التوتر.', '#d88b70', 1),
  ('transitional-institutions', 'المؤسسات الانتقالية', 'مؤسسي', 'جهة خيالية تهتم باستمرارية المؤسسات وتوزيع الموارد بعدالة.', 'حماية الاستقرار وبناء اتفاقات قابلة للتنفيذ.', '#9ba7d8', 1);

INSERT OR REPLACE INTO state_factions (state_id, faction_id, influence, stance_ar) VALUES
  ('khartoum', 'civic-coalition', 70, 'حوار مفتوح'), ('khartoum', 'transitional-institutions', 78, 'استقرار مؤسسي'),
  ('gezira', 'civic-coalition', 58, 'خدمات'), ('gezira', 'community-network', 63, 'شراكة محلية'),
  ('white-nile', 'regional-council', 47, 'تفاوض'), ('white-nile', 'community-network', 66, 'وساطة'),
  ('blue-nile', 'regional-council', 72, 'صلاحيات محلية'), ('blue-nile', 'community-network', 69, 'توافق مجتمعي'),
  ('sennar', 'transitional-institutions', 61, 'استمرارية'), ('sennar', 'civic-coalition', 54, 'خدمات'),
  ('gedaref', 'transitional-institutions', 59, 'تعاون اقتصادي'), ('gedaref', 'community-network', 52, 'تهدئة'),
  ('kassala', 'regional-council', 64, 'تفاوض'), ('kassala', 'community-network', 71, 'تواصل محلي'),
  ('red-sea', 'civic-coalition', 49, 'إدارة عامة'), ('red-sea', 'transitional-institutions', 67, 'استقرار'),
  ('river-nile', 'civic-coalition', 45, 'خدمات'), ('river-nile', 'transitional-institutions', 62, 'تنسيق'),
  ('northern', 'community-network', 48, 'تدرج'), ('northern', 'transitional-institutions', 57, 'تخطيط'),
  ('north-kordofan', 'civic-coalition', 55, 'تفاوض خدمي'), ('north-kordofan', 'regional-council', 51, 'تفاهم'),
  ('south-kordofan', 'regional-council', 74, 'حوار سياسي'), ('south-kordofan', 'community-network', 73, 'ثقة محلية'),
  ('west-kordofan', 'transitional-institutions', 53, 'توازن'), ('west-kordofan', 'regional-council', 62, 'تفاوض'),
  ('north-darfur', 'community-network', 76, 'حماية الخدمات'), ('north-darfur', 'civic-coalition', 57, 'شرعية مدنية'),
  ('south-darfur', 'community-network', 79, 'تهدئة مجتمعية'), ('south-darfur', 'regional-council', 68, 'تفاوض'),
  ('east-darfur', 'regional-council', 65, 'شراكة'), ('east-darfur', 'community-network', 70, 'وساطة'),
  ('west-darfur', 'community-network', 82, 'وساطة محلية'), ('west-darfur', 'civic-coalition', 52, 'خدمات'),
  ('central-darfur', 'regional-council', 67, 'تدرج'), ('central-darfur', 'community-network', 75, 'توافق');

INSERT OR REPLACE INTO objectives (id, title_ar, description_ar, reward_points) VALUES
  ('public-legitimacy', 'بناء الشرعية العامة', 'ارفع الشرعية عبر قرارات شفافة وحوار قابل للشرح.', 30),
  ('service-continuity', 'استمرارية الخدمات', 'وازن بين الموارد والاستقرار حتى لا تتوقف الخدمات المدنية.', 25),
  ('local-dialogue', 'فتح قنوات الحوار المحلي', 'امنح المجتمعات مساحة للتفاوض قبل اتخاذ قرارات واسعة الأثر.', 35);

INSERT OR REPLACE INTO scenario_objectives (scenario_id, objective_id, sequence) VALUES
  ('sandbox-2026', 'public-legitimacy', 1),
  ('sandbox-2026', 'service-continuity', 2),
  ('sandbox-2026', 'local-dialogue', 3);

INSERT OR REPLACE INTO events (id, scenario_id, title_ar, description_ar, choices_json, sequence) VALUES
  ('mediation-session', 'sandbox-2026', 'جلسة وساطة محلية', 'وصلت دعوة لعقد جلسة تستمع إلى مطالب الولاية وتحدد ما يمكن تنفيذه على مراحل.', '[{"id":"open-dialogue","label":"فتح الحوار الآن","description":"زيادة الشرعية والثقة مع كلفة زمنية بسيطة.","effects":{"legitimacy":8,"stability":4,"services":-2}},{"id":"service-first","label":"البدء بحزمة خدمات","description":"تحسين الخدمات بسرعة مع حاجة أكبر للتنسيق.","effects":{"legitimacy":3,"stability":2,"services":9}},{"id":"delay-decision","label":"تأجيل القرار","description":"يحافظ على الموارد مؤقتًا لكنه يضعف الثقة.","effects":{"legitimacy":-5,"stability":-3,"services":1}}]', 1),
  ('resource-compact', 'sandbox-2026', 'اتفاق الموارد العامة', 'تختلف الأطراف حول ترتيب الأولويات. المطلوب صياغة اتفاق معلن لا يمنح جهة واحدة كل المكاسب.', '[{"id":"publish-criteria","label":"نشر معايير التوزيع","description":"يرفع الشفافية ويقلل سوء الفهم.","effects":{"legitimacy":7,"stability":3,"services":4}},{"id":"local-committee","label":"تشكيل لجنة محلية","description":"يقوي المشاركة لكنه يحتاج وقتًا.","effects":{"legitimacy":5,"stability":7,"services":1}},{"id":"central-plan","label":"فرض خطة موحدة","description":"أسرع إداريًا لكنه يضغط على الثقة المحلية.","effects":{"legitimacy":-4,"stability":2,"services":7}}]', 2),
  ('review-round', 'sandbox-2026', 'مراجعة الجولة', 'انتهت الجولة الأولى. هل تعتمد اتفاقًا تدريجيًا وتترك مساحة للمراجعة أم تنتظر توافقًا كاملًا؟', '[{"id":"phased-agreement","label":"اعتماد اتفاق مرحلي","description":"يمنح الأطراف نقطة بداية قابلة للتقييم.","effects":{"legitimacy":6,"stability":6,"services":3}},{"id":"full-consensus","label":"طلب توافق كامل","description":"يحمي الجودة لكنه يبطئ التنفيذ.","effects":{"legitimacy":4,"stability":1,"services":-1}},{"id":"community-review","label":"إحالة الاتفاق للمجتمعات","description":"يرفع الملكية المحلية ويؤخر الحسم.","effects":{"legitimacy":9,"stability":4,"services":-2}}]', 3);
