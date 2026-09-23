import type { ReactNode } from 'react';
import type { AttendanceSummary, BatchSyllabus, FeePlan, FeeSummary, ProgressCard, StudentPerformance, SyllabusProgressRow } from '../types';
import { formatDate, formatMoney, formatPercent } from '../utils/format';
import { DataTable } from './DataTable';
import { Badge, Card, CardHeader, EmptyState, InfoGrid, ProgressBar, StatCard } from './ui';

export function AttendanceStats({ summary }: { summary: AttendanceSummary }) {
  const tone = summary.totalClasses === 0 ? 'default' : summary.attendancePercentage >= 75 ? 'positive' : 'danger';
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <StatCard label="Attendance" value={summary.totalClasses === 0 ? '-' : formatPercent(summary.attendancePercentage)}
        hint={`${summary.totalClasses} classes`} tone={tone} />
      <StatCard label="Present" value={summary.present} />
      <StatCard label="Late" value={summary.late} tone={summary.late > 0 ? 'warning' : 'default'} />
      <StatCard label="Absent" value={summary.absent} tone={summary.absent > 0 ? 'danger' : 'default'} />
      <StatCard label="Excused" value={summary.excused} />
    </div>
  );
}

/** Weighted performance: components, subjects and the recent trend. */
export function PerformanceView({ performance }: { performance: StudentPerformance }) {
  const weights = performance.weights;
  const components: [string, number | undefined, number][] = [
    ['Daily tests', performance.dailyTestAverage, weights.dailyTest],
    ['Weekly tests', performance.weeklyTestAverage, weights.weeklyTest],
    ['Exams', performance.examAverage, weights.exam],
    ['Attendance', performance.attendancePercentage, weights.attendance],
  ];
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Overall performance</p>
          <p className="mt-2 text-4xl font-semibold text-slate-900">{formatPercent(performance.overall)}</p>
          <div className="mt-2 flex items-center gap-2">
            {performance.grade && <Badge value="ACTIVE" label={`Grade ${performance.grade}`} />}
            <span className="text-xs text-slate-500">{formatDate(performance.from)} - {formatDate(performance.to)}</span>
          </div>
        </Card>
        <Card className="p-5 lg:col-span-2">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">How it is calculated</p>
          <div className="space-y-3">
            {components.map(([label, value, weight]) => (
              <div key={label}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-slate-700">{label} <span className="text-xs text-slate-400">weight {weight}</span></span>
                  <span className="font-medium text-slate-800">{formatPercent(value)}</span>
                </div>
                <ProgressBar value={value} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="By subject" />
        <DataTable
          rows={performance.subjects}
          rowKey={(row) => row.subject.id}
          empty="No published results yet"
          columns={[
            { header: 'Subject', render: (row) => row.subject.name },
            { header: 'Tests', render: (row) => formatPercent(row.testAverage) },
            { header: 'Exams', render: (row) => formatPercent(row.examAverage) },
            { header: 'Overall', render: (row) => <span className="font-medium">{formatPercent(row.overall)}</span> },
            { header: 'Grade', render: (row) => row.grade ?? '-' },
            { header: 'Assessments', render: (row) => row.assessments },
          ]}
        />
      </Card>

      <Card>
        <CardHeader title="Recent assessments" />
        <DataTable
          rows={performance.trend}
          rowKey={(row) => `${row.kind}-${row.date}-${row.title}`}
          empty="No published results yet"
          columns={[
            { header: 'Date', render: (row) => formatDate(row.date) },
            { header: 'Assessment', render: (row) => row.title },
            { header: 'Type', render: (row) => row.kind },
            { header: 'Subject', render: (row) => row.subject.name },
            { header: 'Marks', render: (row) => (row.absent ? <Badge value="ABSENT" /> : `${row.marks ?? '-'} / ${row.maxMarks}`) },
            { header: '%', render: (row) => formatPercent(row.percentage) },
          ]}
        />
      </Card>
    </div>
  );
}

/** A progress card as a printable sheet. */
export function ProgressCardView({ card, centreName, actions }: { card: ProgressCard; centreName: string; actions?: ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">{centreName}</p>
          <h2 className="text-lg font-semibold text-slate-900">{card.title}</h2>
          <p className="text-sm text-slate-500">
            {card.student.name} ({card.admissionNumber}) {card.batch ? `· ${card.batch.name}` : ''} &middot;{' '}
            {formatDate(card.periodStart)} - {formatDate(card.periodEnd)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge value={card.status} />
          {actions}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Performance" value={formatPercent(card.performanceScore)} hint={card.grade ? `Grade ${card.grade}` : undefined} />
        <StatCard label="Attendance" value={formatPercent(card.attendancePercentage)} />
        <StatCard label="Exam average" value={formatPercent(card.examAverage)} />
        <StatCard label="Syllabus covered" value={formatPercent(card.syllabusCompletion)} />
      </div>
      <InfoGrid
        items={[
          ['Daily test average', formatPercent(card.dailyTestAverage)],
          ['Weekly test average', formatPercent(card.weeklyTestAverage)],
          ['Discipline incidents', card.disciplineCount],
          ['Pending fines', formatMoney(card.pendingFineAmount)],
        ]}
      />
      {card.items && card.items.length > 0 && (
        <div className="card overflow-hidden">
          <DataTable
            rows={card.items}
            rowKey={(item) => item.id}
            columns={[
              { header: 'Subject', render: (item) => item.subjectName },
              { header: 'Tests', render: (item) => formatPercent(item.testAverage) },
              { header: 'Exams', render: (item) => formatPercent(item.examAverage) },
              { header: 'Overall', render: (item) => formatPercent(item.overallPercentage) },
              { header: 'Grade', render: (item) => item.grade ?? '-' },
              { header: 'Remarks', render: (item) => item.remarks ?? '' },
            ]}
          />
        </div>
      )}
      {card.mentorRemarks && (
        <div className="rounded-lg bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Mentor remarks</p>
          <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{card.mentorRemarks}</p>
        </div>
      )}
    </div>
  );
}

/** Course fee, the student's discount, and what is paid and due. `planActions` adds staff buttons per plan. */
export function FeeSummaryView({ summary, planActions }: { summary: FeeSummary; planActions?: (plan: FeePlan) => ReactNode }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Fee payable" value={formatMoney(summary.netFee)}
          hint={summary.discount > 0 ? `${formatMoney(summary.totalFee)} course fee - ${formatMoney(summary.discount)} discount` : 'Course fee'} />
        <StatCard label="Paid" value={formatMoney(summary.paid)} tone="positive" />
        <StatCard label="Outstanding" value={formatMoney(summary.outstanding)} tone={summary.outstanding > 0 ? 'warning' : 'default'} />
        <StatCard label="Next due" value={summary.nextDueAmount ? formatMoney(summary.nextDueAmount) : '-'}
          hint={summary.nextDueDate ? formatDate(summary.nextDueDate) : undefined}
          tone={summary.overdue > 0 ? 'danger' : 'default'} />
      </div>
      {summary.plans.length === 0 && <Card><EmptyState title="No fee plan yet" /></Card>}
      {summary.plans.map((plan) => (
        <Card key={plan.id}>
          <CardHeader
            title={plan.title}
            subtitle={
              <span>
                Course fee {formatMoney(plan.totalAmount)}
                {plan.discountAmount > 0 && (
                  <span className="text-violet-700"> - discount {formatMoney(plan.discountAmount)}{plan.discountReason ? ` (${plan.discountReason})` : ''}</span>
                )}
                {' '}= <span className="font-semibold text-slate-700">{formatMoney(plan.netAmount)}</span> &middot; paid {formatMoney(plan.paidAmount)}
              </span>
            }
            actions={<>{planActions?.(plan)}<Badge value={plan.status} /></>} />
          <DataTable
            rows={plan.installments}
            rowKey={(row) => row.id}
            columns={[
              { header: 'Installment', render: (row) => row.label },
              { header: 'Due', render: (row) => formatDate(row.dueDate) },
              { header: 'Amount', render: (row) => formatMoney(row.amount) },
              { header: 'Paid', render: (row) => formatMoney(row.paidAmount) },
              { header: 'Balance', render: (row) => formatMoney(row.pendingAmount) },
              { header: 'Status', render: (row) => <Badge value={row.status} /> },
            ]}
          />
        </Card>
      ))}
      <Card>
        <CardHeader title="Payments" />
        <DataTable
          rows={summary.payments}
          rowKey={(row) => row.id}
          empty="No payments yet"
          columns={[
            { header: 'Receipt', render: (row) => row.receiptNumber },
            { header: 'Date', render: (row) => formatDate(row.paymentDate) },
            { header: 'For', render: (row) => `${row.planTitle} - ${row.installmentLabel}` },
            { header: 'Method', render: (row) => <Badge value="PENDING" label={row.paymentMethod.replace('_', ' ')} /> },
            { header: 'Amount', render: (row) => formatMoney(row.amount) },
          ]}
        />
      </Card>
    </div>
  );
}

/**
 * Batch syllabus progress. With `onEdit` each topic gets an update button (faculty and
 * academic staff); students see the same view read-only.
 */
export function SyllabusView({ syllabus, onEdit }: { syllabus: BatchSyllabus; onEdit?: (row: SyllabusProgressRow) => void }) {
  if (syllabus.topics.length === 0) return <EmptyState title="No syllabus topics for this batch yet" />;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Overall completion</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{formatPercent(syllabus.completion)}</p>
          <div className="mt-3"><ProgressBar value={syllabus.completion} /></div>
        </Card>
        {syllabus.subjects.map((subject) => (
          <Card key={subject.subject.id} className="p-4">
            <p className="text-sm font-semibold text-slate-800">{subject.subject.name}</p>
            <p className="text-xs text-slate-500">{subject.completedTopics} of {subject.totalTopics} topics</p>
            <div className="mt-3"><ProgressBar value={subject.completion} tone={subject.completion >= 100 ? 'positive' : 'brand'} /></div>
          </Card>
        ))}
      </div>
      <Card>
        <DataTable
          rows={syllabus.topics}
          rowKey={(row) => row.topicId}
          columns={[
            { header: '#', render: (row) => row.sequenceNo, className: 'w-12' },
            { header: 'Topic', render: (row) => <span className="font-medium text-slate-800">{row.title}</span> },
            { header: 'Subject', render: (row) => row.subject.name },
            { header: 'Planned', render: (row) => formatDate(row.plannedDate) },
            { header: 'Completed', render: (row) => formatDate(row.completedDate) },
            { header: 'Status', render: (row) => <Badge value={row.status} /> },
            ...(onEdit
              ? [{ header: '', render: (row: SyllabusProgressRow) => (
                  <button type="button" className="btn-secondary btn-sm" onClick={() => onEdit(row)}>Update</button>
                ) }]
              : []),
          ]}
        />
      </Card>
    </div>
  );
}
