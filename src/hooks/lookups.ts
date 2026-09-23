import { academicApi, assessmentApi, disciplineApi, staffApi, studentApi } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { useQuery } from './useQuery';

/**
 * Option lists for filters and forms. Each list is only requested when the user may read
 * it, and the server already limits batches and students to the user's own scope.
 */
export function useBatches() {
  const { can } = useAuth();
  const allowed = can('BATCH_VIEW', 'MY_BATCH_VIEW');
  return useQuery(() => academicApi.batches(), [], allowed).data ?? [];
}

export function useCourses() {
  const { can } = useAuth();
  return useQuery(() => academicApi.courses(), [], can('COURSE_VIEW')).data ?? [];
}

export function useSubjects(courseId?: number) {
  const { can } = useAuth();
  return useQuery(() => academicApi.subjects(courseId), [courseId], can('SUBJECT_VIEW')).data ?? [];
}

export function useYears() {
  const { can } = useAuth();
  return useQuery(() => academicApi.years(), [], can('ACADEMIC_YEAR_VIEW')).data ?? [];
}

export function useMentors() {
  const { can } = useAuth();
  return useQuery(() => staffApi.mentors(), [], can('MENTOR_VIEW')).data ?? [];
}

export function useFacultyList() {
  const { can } = useAuth();
  return useQuery(() => staffApi.faculty(), [], can('FACULTY_VIEW')).data ?? [];
}

export function useStudents(batchId?: number) {
  const { can } = useAuth();
  return useQuery(
    () => studentApi.search({ batchId, status: 'ACTIVE' }),
    [batchId],
    can('STUDENT_VIEW', 'ASSIGNED_STUDENT_VIEW'),
  ).data ?? [];
}


export function useExamTypes() {
  const { can } = useAuth();
  return useQuery(() => assessmentApi.examTypes(), [], can('EXAM_VIEW', 'MASTER_DATA_MANAGE')).data ?? [];
}

export function useDisciplineTypes() {
  const { can } = useAuth();
  return useQuery(() => disciplineApi.types(), [], can('DISCIPLINE_VIEW', 'MASTER_DATA_MANAGE')).data ?? [];
}
