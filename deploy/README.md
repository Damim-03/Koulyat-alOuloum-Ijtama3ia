# نشر منصة مذكرتي بـ Docker

ثلاث حاويات تعمل معاً (`compose.yaml`):

| الحاوية | ما هي | من يصلها |
|---|---|---|
| `db` | قاعدة البيانات MariaDB | المنصة وحدها — لا منفذ على الجهاز، ولا خروج إلى الإنترنت |
| `app` | المنصة: الخادم والواجهة والتحديث الحيّ (`../Dockerfile`) | Caddy وحده |
| `caddy` | الباب الأمامي: HTTPS وشهادة تتجدّد وحدها | الشبكة، على المنفذين 80 و443 |

كل ما يجب أن يبقى بعد إعادة البناء في مجلّدات Docker دائمة (volumes):
قاعدة البيانات، والصور المرفوعة، والملفات الخاصة (صور التفعيل ومرفقات الرسائل)، وشهادة HTTPS.

---

## 1. تثبيت Docker على Arch Linux

```bash
sudo pacman -S --needed docker docker-compose docker-buildx
sudo systemctl enable --now docker
sudo usermod -aG docker $USER     # ثم اخرج من الجلسة وادخل من جديد
```

**الساعة مهمّة:** رموز التحقّق بخطوتين للمسؤول تعتمد على الوقت. على قرصٍ يُقلع
بجانب Windows قد تتأخّر الساعة ساعةً كاملة:

```bash
sudo timedatectl set-ntp true
timedatectl            # يجب أن ترى: System clock synchronized: yes
```

## 2. نقل المشروع

إمّا من GitHub (بعد رفع آخر التعديلات):

```bash
git clone https://github.com/Damim-03/Koulyat-alOuloum-Ijtama3ia.git mudhakkirati
```

أو نسخ مجلّد المشروع كما هو (دون `node_modules` و`dist` — تُبنى داخل الصورة).

## 3. الإعدادات

**مواقع العناوين في سجلّ العمليات** (البلد والولاية والمدينة والمشغّل): ملفّان من DB-IP
يوضعان في `Backend/geo` **قبل البناء** فيدخلان الصورة — الأوامر في
[`Backend/geo/README.md`](../Backend/geo/README.md). بدونهما يعمل كلّ شيء، والسجلّ بلا أماكن.
وتُحدَّث كلّ شهر: ملفّا الشهر الجديد، ثمّ `docker compose up -d --build`.

```bash
cd mudhakkirati/deploy
cp .env.example .env
chmod 600 .env
```

ولّد كلّ سرٍّ على حدة (أربع مرّات: `DB_PASSWORD`، `JWT_ACCESS_SECRET`،
`JWT_REFRESH_SECRET`، `SESSION_SECRET`):

```bash
openssl rand -base64 48 | tr '+/' '-_' | tr -d '='
```

وضع إعدادات Gmail نفسها التي جرّبتها (`SMTP_*`) إن أردت البريد.

## 4. التجربة الأولى: على الجهاز نفسه

في `.env`:

```
DOMAIN=localhost
```

ثم:

```bash
docker compose up -d --build        # البناء الأول يأخذ بضع دقائق
docker compose ps                   # الثلاثة: running / healthy
docker compose logs -f app          # Ctrl+C للخروج من السجلّ
```

افتح `https://localhost` — سيحذّرك المتصفّح من الشهادة (محلّية)، فتابع.

> إن كان برنامجٌ آخر يشغل المنفذين 80 و443 (Apache مثلاً)، أضف إلى `.env`:
> `HTTP_PORT=8080` و`HTTPS_PORT=8443` و`PUBLIC_ORIGIN=https://localhost:8443`،
> وافتح `https://localhost:8443`.

### أوّل مسؤول

القاعدة جديدة وفارغة: لا حسابات فيها. أنشئ المسؤول الأول (يسألك عن البريد
وكلمة المرور دون أن تظهر):

```bash
docker compose exec app node dist/cli/create-admin.js
```

ادخل به، وسيطلب منك إعداد التحقّق بخطوتين (Google Authenticator أو ما يشبهه).

## 5أ. تجربة بعنوان HTTPS حقيقي دون نطاق: نفق Cloudflare

مجّاني، بلا حساب، بلا راوتر — ويعمل خلف CGNAT. تفتح المنصّة من هاتفك، وروابط
البريد تُفتح من أيّ جهاز.

```bash
bash tunnel.sh          # يطبع العنوان: https://….trycloudflare.com
bash tunnel.sh stop     # يُخرج المنصّة من الإنترنت
```

- العنوان **يتغيّر عند كلّ تشغيل** للنفق؛ السكربت يكتبه في `.env`
  (`PUBLIC_ORIGIN`) ويعيد تشغيل المنصّة به.
- ما دام النفق يعمل **فالمنصّة على الإنترنت**: من يعرف العنوان يصل صفحة الدخول.
- المنفذان 80 و443 لا حاجة لهما هنا: ضع `LISTEN_ADDRESS=127.0.0.1` في `.env`
  فلا يُفتح على الشبكة إلّا النفق.

## 5ب. نطاق حقيقي و HTTPS تلقائي

يلزم ثلاثة أشياء:

1. **نطاق** (`memoires.example.com`) سجلّه `A` يشير إلى العنوان العامّ لاتّصالك.
   اعرف العنوان العامّ بـ: `curl -4 ifconfig.me`
2. **تحويل المنافذ في الراوتر**: 80 و443 (TCP، و443 UDP) إلى عنوان جهاز Arch
   في الشبكة المحلّية (`ip -4 addr`).
3. **ألّا يكون الاتّصال خلف CGNAT**: إن كان العنوان الذي يُظهره الراوتر في صفحته
   (WAN) غير العنوان الذي يُظهره `ifconfig.me`، فالاتّصال مشترك ولن يصل أحدٌ
   من الخارج — والحلّ حينها نفقٌ (Cloudflare Tunnel) بدل تحويل المنافذ.

ثم في `.env`:

```
DOMAIN=memoires.example.com
ACME_EMAIL=بريدك
```

```bash
docker compose up -d
docker compose logs -f caddy        # انتظر: certificate obtained successfully
```

روابط البريد (الاستعادة والتأكيد) تصير `https://النطاق/...` — تُفتح من أيّ جهاز.

## الاستعمال اليومي

| ماذا | الأمر |
|---|---|
| الحالة | `docker compose ps` |
| سجلّ المنصة | `docker compose logs -f app` |
| إيقاف (البيانات تبقى) | `docker compose down` |
| تشغيل | `docker compose up -d` |
| تحديث بعد تعديل الكود | `git pull` ثم `docker compose up -d --build` |

> ⚠️ `docker compose down -v` **يحذف البيانات كلّها** — قاعدة البيانات والملفات.
> لا تستعمله إلّا لتبدأ من الصفر عن قصد.

### نسخة احتياطية

```bash
# قاعدة البيانات
docker compose exec db sh -c 'mariadb-dump -u mudhakkirati -p"$MARIADB_PASSWORD" mudhakkirati' > backup-$(date +%F).sql

# الملفات (المرفوعة والخاصّة)
docker run --rm -v mudhakkirati_uploads:/u -v mudhakkirati_storage:/s -v "$PWD":/b alpine \
  tar czf /b/files-$(date +%F).tgz -C / u s
```

## ما يحرسه هذا الإعداد

- لا سرّ داخل الصورة: `.env` يُعطى عند التشغيل، و`.dockerignore` يُبعد كلّ
  `.env` والحسابات التجريبية (`Backend/dev-only`) والاختبارات.
- المنصة تعمل بمستخدمٍ عاديّ (`node`) لا بـ root.
- قاعدة البيانات على شبكةٍ داخلية: لا تُرى من الجهاز ولا من الإنترنت.
- لا سجلّ وصولٍ في Caddy: روابط البريد تحمل رمزها في العنوان، والمنصة تسجّل
  كلّ طلبٍ بلا ما بعد `?`.
- `TRUST_PROXY_HOPS=1`: عنوان كلّ زائرٍ الحقيقي يُقرأ من Caddy، فحدود المحاولات
  تعمل لكلّ عنوانٍ على حدة.
