import unittest
from scripts.extract import assign_ids


def q(hash_, ordinal):
    return {"hash": hash_, "sourcePath": "ch1/quiz.html", "sourceOrdinal": ordinal, "sourceChapter": 1}


class RegistryTest(unittest.TestCase):
    def setUp(self):
        self.old = [
            {"id": "cn-1-001", "hash": "one", "sourcePath": "ch1/quiz.html", "sourceOrdinal": 1},
            {"id": "cn-1-002", "hash": "two", "sourcePath": "ch1/quiz.html", "sourceOrdinal": 2},
        ]

    def test_reorder_keeps_identity(self):
        items = [q("two", 1), q("one", 2)]
        assign_ids(items, self.old)
        self.assertEqual([x["id"] for x in items], ["cn-1-002", "cn-1-001"])

    def test_new_question_does_not_steal_old_id(self):
        items = [q("new", 1), q("one", 2), q("two", 3)]
        assign_ids(items, self.old)
        self.assertEqual([x["id"] for x in items], ["cn-1-003", "cn-1-001", "cn-1-002"])

    def test_changed_question_requires_review(self):
        with self.assertRaisesRegex(ValueError, "source changed"):
            assign_ids([q("one", 1), q("edited", 2)], self.old)

    def test_duplicate_content_requires_review(self):
        with self.assertRaisesRegex(ValueError, "duplicate content"):
            assign_ids([q("one", 1), q("one", 2), q("two", 3)], self.old)

    def test_new_duplicate_content_requires_review(self):
        with self.assertRaisesRegex(ValueError, "duplicate content"):
            assign_ids([q("one", 1), q("two", 2), q("new", 3), q("new", 4)], self.old)

    def test_duplicate_registry_id_requires_review(self):
        damaged = [{**self.old[0]}, {**self.old[1], "id": "cn-1-001"}]
        with self.assertRaisesRegex(ValueError, "duplicate registry IDs"):
            assign_ids([q("one", 1), q("two", 2)], damaged)


if __name__ == "__main__":
    unittest.main()
