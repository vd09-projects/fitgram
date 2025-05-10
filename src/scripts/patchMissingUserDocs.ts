import { getDocs, collectionGroup, doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../services/firebase/firebase";

const patchMissingUserDocs = async () => {
  const infoDocsSnapshot = await getDocs(collectionGroup(db, "info"));

  for (const infoDoc of infoDocsSnapshot.docs) {
    const userId = infoDoc.ref.parent.parent?.id;

    // ⛔ Skip if userId is undefined
    if (!userId) continue;

    const userRootDocRef = doc(db, "users", userId);
    const rootDocSnapshot = await getDoc(userRootDocRef);

    if (!rootDocSnapshot.exists()) {
      console.log(`⚠️ User root doc not found for userId: ${userId}`);
      const infoData = infoDoc.data();

      await setDoc(userRootDocRef, {
        uid: userId,
        verified: true,
        createdAt: new Date(),
        patchedFromInfo: true,
      });

      console.log(`✅ Patched user: ${userId}`);
    } else {
      console.log(`⚠️ User root doc already exists for userId: ${userId}`);
    }
  }
};

patchMissingUserDocs()