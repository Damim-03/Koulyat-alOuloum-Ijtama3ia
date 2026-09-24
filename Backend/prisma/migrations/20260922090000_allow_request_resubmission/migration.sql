-- إعادةُ الطلب على الموضوع نفسه بعد الرفض.
--
-- كان `GroupRequest_leaderStudentId_topicId_key` يمنع المرسِل من طلبٍ ثانٍ
-- على الموضوع نفسه. وكان ذلك بلا أثرٍ يوم كان الرفضُ يحذف الصفّ؛ فلمّا صار
-- الرفضُ يُبقيه صار القيدُ يمنع إعادة الطلب إلى الأبد.
--
-- ولا يُفتح بهذا بابُ التكرار: `GroupRequest_activeTopicId_key` يمنع أن يكون
-- للموضوع أكثرُ من طلبٍ حيٍّ واحد، و`GraduationTopic.maxRequests` يحدّ مجموع
-- المحاولات.
--
-- والترتيب مقصود: المفتاحُ الأجنبيّ `leaderStudentId → Student` كان يتّكئ على
-- هذا الفريد المركَّب (عمودُه الأيسر)، فيُنشأ البديل أوّلاً ثمّ يُحذف الأصل،
-- وإلّا رفضت القاعدة الحذف.

CREATE INDEX `GroupRequest_leaderStudentId_idx` ON `GroupRequest`(`leaderStudentId`);

DROP INDEX `GroupRequest_leaderStudentId_topicId_key` ON `GroupRequest`;
