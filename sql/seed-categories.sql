CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO entry_categories (id, type, name, keywords)
VALUES
  (gen_random_uuid()::text, 'income', 'Salary', ARRAY['salary', 'wage', 'paycheck', 'pay']::text[]),
  (gen_random_uuid()::text, 'income', 'Freelance', ARRAY['freelance', 'gig', 'contract']::text[]),
  (gen_random_uuid()::text, 'income', 'Bonus', ARRAY['bonus', 'performance bonus', 'incentive']::text[]),
  (gen_random_uuid()::text, 'income', 'Business', ARRAY['business', 'self-employed', 'self employment', 'company']::text[]),
  (gen_random_uuid()::text, 'income', 'Investments', ARRAY['investment', 'investments', 'capital gains', 'returns']::text[]),
  (gen_random_uuid()::text, 'income', 'Dividends', ARRAY['dividend', 'dividends']::text[]),
  (gen_random_uuid()::text, 'income', 'Interest', ARRAY['interest', 'savings interest']::text[]),
  (gen_random_uuid()::text, 'income', 'Rental Income', ARRAY['rent', 'rental', 'property income']::text[]),
  (gen_random_uuid()::text, 'expense', 'Housing', ARRAY['housing', 'rent', 'mortgage', 'home']::text[]),
  (gen_random_uuid()::text, 'expense', 'Utilities', ARRAY['utilities', 'electricity', 'water', 'gas', 'internet']::text[]),
  (gen_random_uuid()::text, 'expense', 'Food', ARRAY['food', 'groceries', 'grocery', 'restaurant', 'dining']::text[]),
  (gen_random_uuid()::text, 'expense', 'Transport', ARRAY['transport', 'transportation', 'fuel', 'gasoline', 'uber', 'taxi']::text[]),
  (gen_random_uuid()::text, 'expense', 'Healthcare', ARRAY['healthcare', 'medical', 'doctor', 'pharmacy']::text[]),
  (gen_random_uuid()::text, 'expense', 'Insurance', ARRAY['insurance', 'health insurance', 'car insurance']::text[]),
  (gen_random_uuid()::text, 'expense', 'Debt Payments', ARRAY['debt', 'loan', 'credit card', 'repayment']::text[]),
  (gen_random_uuid()::text, 'expense', 'Education', ARRAY['education', 'school', 'tuition', 'course']::text[]),
  (gen_random_uuid()::text, 'expense', 'Shopping', ARRAY['shopping', 'clothes', 'electronics', 'retail']::text[]),
  (gen_random_uuid()::text, 'expense', 'Entertainment', ARRAY['entertainment', 'movies', 'games', 'subscriptions']::text[])
ON CONFLICT (type, name) DO UPDATE
SET keywords = EXCLUDED.keywords;
